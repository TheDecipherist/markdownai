import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOC = '@markdownai\n'

function run(source: string, opts?: object) {
  const ast = parse(source)
  return execute(ast, opts as Parameters<typeof execute>[1])
}

function noSecurityCtx() {
  return {
    ctx: {
      security: {
        allowShell: false,
        allowHttp: false,
        allowDb: false,
        jailRoot: null,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Off by default
// ---------------------------------------------------------------------------

describe('engine tracing — disabled by default', () => {
  beforeEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
  })

  it('produces no trace output when MARKDOWNAI_TRACE is not set', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const traceWrites = stderrSpy.mock.calls.filter(args =>
      typeof args[0] === 'string' && args[0].includes('"status"')
    )
    expect(traceWrites).toHaveLength(0)
    stderrSpy.mockRestore()
  })

  it('has zero ctx.traceConfig overhead — executes without errors when disabled', () => {
    const result = run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    expect(result.errors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Stderr sink
// ---------------------------------------------------------------------------

describe('engine tracing — stderr sink', () => {
  beforeEach(() => {
    process.env['MARKDOWNAI_TRACE'] = 'stderr'
  })

  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('emits a start span to stderr when a directive executes', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const startSpan = spans.find((s: Record<string, unknown>) => s['status'] === 'start' && s['directive'] === 'env')
    expect(startSpan).toBeDefined()
  })

  it('emits matching start and end spans with the same id', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const startSpan = spans.find((s: Record<string, unknown>) => s['status'] === 'start' && s['directive'] === 'env')
    const endSpan = spans.find((s: Record<string, unknown>) => s['status'] === 'end' && s['directive'] === 'env')
    expect(startSpan).toBeDefined()
    expect(endSpan).toBeDefined()
    expect(startSpan!['id']).toBe(endSpan!['id'])
  })

  it('end span includes duration and outputSize', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const endSpan = spans.find((s: Record<string, unknown>) => s['status'] === 'end' && s['directive'] === 'env')
    expect(endSpan).toBeDefined()
    expect(typeof endSpan!['duration']).toBe('number')
    expect(typeof endSpan!['outputSize']).toBe('number')
  })

  it('span includes document, line, runId, and timestamp fields', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const span = spans.find((s: Record<string, unknown>) => s['directive'] === 'env')
    expect(span).toBeDefined()
    expect(typeof span!['runId']).toBe('string')
    expect(span!['runId']).not.toBe('')
    expect(typeof span!['timestamp']).toBe('number')
    expect(typeof span!['line']).toBe('number')
  })

  it('all spans in one execute() call share the same runId', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env A fallback="1"\n@env B fallback="2"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const runIds = [...new Set(spans.map((s: Record<string, unknown>) => s['runId']))]
    expect(runIds).toHaveLength(1)
  })

  it('emits valid JSON-Lines (each line is parseable)', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const lines = writes.join('').split('\n').filter(Boolean)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// MARKDOWNAI_TRACE alternate values
// ---------------------------------------------------------------------------

describe('engine tracing — stderr aliases', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('MARKDOWNAI_TRACE=1 activates stderr sink', () => {
    process.env['MARKDOWNAI_TRACE'] = '1'
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean))
    expect(spans.length).toBeGreaterThan(0)
  })

  it('MARKDOWNAI_TRACE=true activates stderr sink', () => {
    process.env['MARKDOWNAI_TRACE'] = 'true'
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean))
    expect(spans.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Invalid sink value
// ---------------------------------------------------------------------------

describe('engine tracing — invalid MARKDOWNAI_TRACE value', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('emits a warning to stderr and disables tracing when sink is unrecognized', () => {
    process.env['MARKDOWNAI_TRACE'] = 'ftp://bad-sink'
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    const result = run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    expect(result.errors).toHaveLength(0)
    const combined = writes.join('')
    expect(combined).toMatch(/MARKDOWNAI_TRACE|trace|warning/i)
    const spanLines = writes.flatMap(w => w.split('\n').filter(Boolean)).filter(l => {
      try { const p = JSON.parse(l); return 'status' in p && ('directive' in p || 'ast' in p) } catch { return false }
    })
    expect(spanLines).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// File sink
// ---------------------------------------------------------------------------

describe('engine tracing — file sink', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('writes JSON-Lines span data to the configured file path', async () => {
    const { readFileSync, unlinkSync, existsSync } = await import('node:fs')
    const tracePath = `/tmp/markdownai-trace-test-${Date.now()}.jsonl`
    process.env['MARKDOWNAI_TRACE'] = `file:${tracePath}`
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    await new Promise(r => setTimeout(r, 80))
    expect(existsSync(tracePath)).toBe(true)
    const content = readFileSync(tracePath, 'utf8')
    const lines = content.split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
    unlinkSync(tracePath)
  })
})

// ---------------------------------------------------------------------------
// HTTP sink
// ---------------------------------------------------------------------------

describe('engine tracing — http sink', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('POSTs span data to the configured HTTP endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    process.env['MARKDOWNAI_TRACE'] = 'http://localhost:4317/trace'
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    await new Promise(r => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:4317/trace')
    expect(init.method).toBe('POST')
    expect(() => JSON.parse(init.body as string)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Args masking
// ---------------------------------------------------------------------------

describe('engine tracing — args masking', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('masks secret-like values in directive args before serialization', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    process.env['MARKDOWNAI_TRACE'] = 'stderr'
    process.env['DB_PASSWORD'] = 'super-secret-password=abc123'
    run(`${DOC}@env DB_PASSWORD fallback="password=should-be-masked"`, noSecurityCtx())
    const combined = writes.join('')
    expect(combined).not.toContain('super-secret-password')
    delete process.env['DB_PASSWORD']
  })
})

// ---------------------------------------------------------------------------
// Error spans
// ---------------------------------------------------------------------------

describe('engine tracing — error spans', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('emits an error span when a directive throws', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    process.env['MARKDOWNAI_TRACE'] = 'stderr'
    // A pipe with a shell step throws when allowShell=false — the 'pipe' node propagates the error
    run(`${DOC}@list ./ | awk '{print}'`, {
      ctx: {
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null },
      },
    })
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const errSpan = spans.find((s: Record<string, unknown>) => s['status'] === 'error')
    expect(errSpan).toBeDefined()
    expect(typeof errSpan!['error']).toBe('string')
    expect(errSpan!['error']).not.toBe('')
  })
})

// ---------------------------------------------------------------------------
// Span fields — phase and callstack
// ---------------------------------------------------------------------------

describe('engine tracing — phase and callstack in spans', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('span callstack is empty at top-level directive', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    process.env['MARKDOWNAI_TRACE'] = 'stderr'
    run(`${DOC}@env FOO fallback="bar"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const startSpan = spans.find((s: Record<string, unknown>) => s['status'] === 'start' && s['directive'] === 'env')
    expect(startSpan!['callstack']).toEqual([])
  })

  it('span callstack reflects the active phase', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    process.env['MARKDOWNAI_TRACE'] = 'stderr'
    run(`${DOC}@phase setup\n@env FOO fallback="bar"\n@end`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const envSpan = spans.find((s: Record<string, unknown>) => s['directive'] === 'env')
    expect(envSpan).toBeDefined()
    expect(envSpan!['callstack']).toContain('phase:setup')
  })
})

// ---------------------------------------------------------------------------
// Multiple directive types traced
// ---------------------------------------------------------------------------

describe('engine tracing — multiple directive types', () => {
  afterEach(() => {
    delete process.env['MARKDOWNAI_TRACE']
    vi.restoreAllMocks()
  })

  it('traces markdown nodes and env directives', () => {
    const writes: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') writes.push(chunk)
      return true
    })
    process.env['MARKDOWNAI_TRACE'] = 'stderr'
    run(`${DOC}@env A fallback="1"\n@env B fallback="2"`, noSecurityCtx())
    const spans = writes.flatMap(w => w.split('\n').filter(Boolean)).map(l => JSON.parse(l))
    const envSpans = spans.filter((s: Record<string, unknown>) => s['directive'] === 'env' && s['status'] === 'start')
    expect(envSpans.length).toBeGreaterThanOrEqual(2)
  })
})
