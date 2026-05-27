import { describe, it, expect, vi, afterEach } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import type { EventSecurityConfig } from '../security/config.js'

// Prevent Worker creation during tests — external transport I/O is covered in event-transports.test.ts
vi.mock('../transports/index.js', () => ({
  dispatchExternal: vi.fn(),
  resolveTransportType: (name: string) => name === 'mcp' ? 'mcp' : 'external',
  INTERNAL_TRANSPORTS: new Set(['mcp']),
  BUILT_IN_EXTERNAL: new Set(['log', 'vscode', 'websocket', 'file', 'http', 'db']),
}))

import { dispatchExternal } from '../transports/index.js'

const DOC = '@markdownai\n'

afterEach(() => {
  vi.clearAllMocks()
})

function run(source: string, opts?: object) {
  const ast = parse(source)
  return execute(ast, opts as Parameters<typeof execute>[1])
}

function eventOpts(cfg: Partial<EventSecurityConfig> & Pick<EventSecurityConfig, 'allowed_transports'>) {
  return {
    ctx: {
      security: {
        allowShell: false,
        allowHttp: false,
        allowDb: false,
        jailRoot: null,
        eventConfig: {
          allow_env_interpolation: false,
          max_value_length: 500,
          onError: 'silence' as const,
          ...cfg,
        },
      },
    },
  }
}

const mcpOnly = eventOpts({ allowed_transports: ['mcp'] })

// ---------------------------------------------------------------------------
// Security / transport gate
// ---------------------------------------------------------------------------

describe('@event — security / transport gate /', () => {
  it('produces no events when allowed_transports is empty (default)', () => {
    const result = run(`${DOC}@event name='ping' data='hello' transport='mcp' /`, eventOpts({ allowed_transports: [] }))
    expect(result.events).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('fires to a single allowlisted transport and produces one EngineEvent', () => {
    const result = run(`${DOC}@event name='done' data='ok' transport='mcp' /`, mcpOnly)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ name: 'done', data: 'ok', transport: 'mcp' })
  })

  it('fires to multiple transports simultaneously — one EngineEvent per transport', () => {
    const result = run(
      `${DOC}@event name='step' data='running' transport='mcp,log' /`,
      eventOpts({ allowed_transports: ['mcp', 'log'] }),
    )
    // mcp: synchronous event in result.events; log: fire-and-forget via worker (mocked)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.transport).toBe('mcp')
    expect(vi.mocked(dispatchExternal)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(dispatchExternal).mock.calls[0]?.[0].transport).toBe('log')
  })

  it('silences a transport that is not in allowed_transports (no error, no event)', () => {
    const result = run(
      `${DOC}@event name='x' data='v' transport='log' /`,
      eventOpts({ allowed_transports: [], onError: 'silence' }),
    )
    expect(result.events).toEqual([])
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('adds to warnings when onError is "warn" and transport is not allowlisted', () => {
    const result = run(
      `${DOC}@event name='x' data='v' transport='log' /`,
      eventOpts({ allowed_transports: [], onError: 'warn' }),
    )
    expect(result.warnings.some(w => w.includes('log') && w.includes('allowlist'))).toBe(true)
  })

  it('surfaces an error when onError is "fail" and transport is not allowlisted', () => {
    // execute() catches walkNode throws and adds them to result.errors
    const result = run(
      `${DOC}@event name='x' data='v' transport='log' /`,
      eventOpts({ allowed_transports: [], onError: 'fail' }),
    )
    expect(result.errors.some(e => e.includes('transport not in allowed_transports'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Interpolation gate
// ---------------------------------------------------------------------------

describe('@event — interpolation gate /', () => {
  it('does NOT evaluate {{ expression }} in data when allow_env_interpolation is false (default)', () => {
    const result = run(`${DOC}@event name='x' data='{{ env.MY_VAR }}' transport='mcp' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
        envFiles: { MY_VAR: 'resolved_value' },
      },
    })
    expect(result.events[0]?.data).toBe('{{ env.MY_VAR }}')
  })

  it('evaluates {{ expression }} in data when allow_env_interpolation is true', () => {
    const result = run(`${DOC}@event name='x' data='{{ env.MY_VAR }}' transport='mcp' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: true, max_value_length: 500, onError: 'silence' },
        },
        envFiles: { MY_VAR: 'resolved_value' },
      },
    })
    expect(result.events[0]?.data).toBe('resolved_value')
  })
})

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

describe('@event — masking /', () => {
  it('applyMasking runs on data even when allow_env_interpolation is false', () => {
    const result = run(
      `${DOC}@event name='x' data='secret=abc123' transport='mcp' /`,
      mcpOnly,
    )
    expect(result.events[0]?.data).toBe('***MASKED***')
  })

  it('masks a known secret pattern in plain data to ***MASKED*** before dispatch', () => {
    const result = run(
      `${DOC}@event name='leak' data='api_key=sk-1234567890abcdef' transport='mcp' /`,
      mcpOnly,
    )
    expect(result.events[0]?.data).toContain('***MASKED***')
    expect(result.events[0]?.data).not.toContain('sk-1234567890')
  })

  it('masks a secret embedded in a JSON data value before dispatch', () => {
    const result = run(
      `${DOC}@event name='x' data='{"token":"Bearer supersecrettoken1234567890"}' transport='mcp' /`,
      mcpOnly,
    )
    expect(result.events[0]?.data).toContain('***MASKED***')
    expect(result.events[0]?.data).not.toContain('supersecrettoken')
  })

  it('fires a SECURITY_ALERT that appears in warnings when masking triggers', () => {
    const result = run(
      `${DOC}@event name='leaky' data='secret=leaked' transport='mcp' /`,
      mcpOnly,
    )
    expect(result.warnings.some(w => w.includes('SECURITY_ALERT'))).toBe(true)
    expect(result.warnings.some(w => w.includes('leaky'))).toBe(true) // event name
  })
})

// ---------------------------------------------------------------------------
// Length cap
// ---------------------------------------------------------------------------

describe('@event — length cap /', () => {
  it('truncates data exceeding max_value_length and adds a warning', () => {
    const longData = 'x'.repeat(200)
    const result = run(
      `${DOC}@event name='big' data='${longData}' transport='mcp' /`,
      eventOpts({ allowed_transports: ['mcp'], max_value_length: 50 }),
    )
    expect(result.events[0]?.data.length).toBe(50)
    expect(result.warnings.some(w => w.includes('truncated') && w.includes('big'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Output / visibility
// ---------------------------------------------------------------------------

describe('@event — output visibility /', () => {
  it('produces no output in the rendered document when visible flag is absent', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    expect(result.output).toBe('')
  })

  it('renders a blockquote containing name and plain data when visible flag is present', () => {
    const result = run(
      `${DOC}@event step data='processing' transport='mcp' visible /`,
      mcpOnly,
    )
    expect(result.output).toContain('**event**')
    expect(result.output).toContain('`step`')
    expect(result.output).toContain('processing')
  })

  it('renders a pretty-printed JSON blockquote when visible flag is present and data is JSON', () => {
    const result = run(
      `${DOC}@event prog data='{"step":1,"total":5}' transport='mcp' visible /`,
      mcpOnly,
    )
    expect(result.output).toContain('```json')
    expect(result.output).toContain('"step": 1')
    expect(result.output).toContain('"total": 5')
  })
})

// ---------------------------------------------------------------------------
// Context / accumulation
// ---------------------------------------------------------------------------

describe('@event — context and accumulation /', () => {
  it('events accumulate in EngineResult.events in document execution order', () => {
    const result = run(
      `${DOC}@event name='first' data='a' transport='mcp' /\n@event name='second' data='b' transport='mcp' /`,
      mcpOnly,
    )
    expect(result.events).toHaveLength(2)
    expect(result.events[0]?.name).toBe('first')
    expect(result.events[1]?.name).toBe('second')
  })

  it('captures the enclosing phase name in EngineEvent.phase when inside a @phase block', () => {
    const result = run(
      `${DOC}@phase setup\n  @event name='ping' data='ok' transport='mcp' /\n@phase-end`,
      {
        ctx: {
          phase: 'setup',
          security: {
            allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
            eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
          },
        },
      },
    )
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.phase).toBe('setup')
  })

  it('sets EngineEvent.phase to null when @event is outside any phase block', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]?.phase).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('@event — metadata (meta field) /', () => {
  it('meta.datetime is a valid ISO 8601 string', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    const datetime = result.events[0]?.meta.datetime
    expect(typeof datetime).toBe('string')
    expect(() => new Date(datetime!).toISOString()).not.toThrow()
    expect(new Date(datetime!).toISOString()).toBe(datetime)
  })

  it('meta.line is a positive integer matching the source line', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    const line = result.events[0]?.meta.line
    expect(typeof line).toBe('number')
    expect(line).toBeGreaterThan(0)
  })

  it('meta.runId is a non-empty string — same for all events in one execute() call', () => {
    const result = run(
      `${DOC}@event name='first' data='a' transport='mcp' /\n@event name='second' data='b' transport='mcp' /`,
      mcpOnly,
    )
    expect(result.events).toHaveLength(2)
    const id0 = result.events[0]?.meta.runId
    const id1 = result.events[1]?.meta.runId
    expect(typeof id0).toBe('string')
    expect(id0!.length).toBeGreaterThan(0)
    expect(id0).toBe(id1)
  })

  it('meta.sessionId is null when no MCP context is provided', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    expect(result.events[0]?.meta.sessionId).toBeNull()
  })

  it('meta.sessionId matches ctx.mcp.sessionId when an MCP context is present', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, {
      ctx: {
        mcp: { sessionId: 'sess-abc' },
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
      },
    })
    expect(result.events[0]?.meta.sessionId).toBe('sess-abc')
  })

  it('meta.model reflects ctx.model when set', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, {
      ctx: {
        model: 'claude-opus-4-7',
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
      },
    })
    expect(result.events[0]?.meta.model).toBe('claude-opus-4-7')
  })

  it('meta.tokenUsage reflects ctx.tokenUsage when set', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, {
      ctx: {
        tokenUsage: 4096,
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
      },
    })
    expect(result.events[0]?.meta.tokenUsage).toBe(4096)
  })

  it('meta.callstack is empty when @event is at the document top level', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    expect(result.events[0]?.meta.callstack).toEqual([])
  })

  it('meta.callstack contains "phase:<name>" when @event is inside a @phase block', () => {
    const result = run(
      `${DOC}@phase setup\n  @event name='ping' data='ok' transport='mcp' /\n@phase-end`,
      {
        ctx: {
          phase: 'setup',
          security: {
            allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
            eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
          },
        },
      },
    )
    expect(result.events[0]?.meta.callstack).toEqual(['phase:setup'])
  })

  it('meta.git is null or has string hash and short fields', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, mcpOnly)
    const git = result.events[0]?.meta?.git
    if (git != null) {
      expect(typeof git.hash).toBe('string')
      expect(typeof git.short).toBe('string')
      expect(git.hash.length).toBeGreaterThan(0)
      expect(git.short.length).toBeGreaterThan(0)
    } else {
      expect(git ?? null).toBeNull()
    }
  })
})
