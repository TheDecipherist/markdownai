import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { McpClient } from './helpers/mcp-helpers.js'
import { spawnMcpServer, MCP_FIXTURES } from './helpers/mcp-helpers.js'

// ─── read_file ────────────────────────────────────────────────────────────────

describe('MCP E2E — tool: read_file', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('reads a MarkdownAI document and returns rendered content', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'multi-phase.md' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { content: string; isMarkdownAI: boolean }
    expect(result.isMarkdownAI).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.content).not.toContain('@phase')
    expect(result.content).not.toContain('@end')
  })

  it('missing file returns well-formed result with warning (no crash)', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'does-not-exist.md' },
    })
    // Should be a result (possibly with warnings), not a crash
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
  })
})

// ─── list_phases ──────────────────────────────────────────────────────────────

describe('MCP E2E — tool: list_phases', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('returns 3 phases from multi-phase.md', async () => {
    const resp = await client.call('tools/call', {
      name: 'list_phases',
      arguments: { file: 'multi-phase.md' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { phases: Array<{ name: string; transitions: unknown[] }> }
    expect(result.phases).toHaveLength(3)
    const names = result.phases.map((p) => p.name)
    expect(names).toContain('setup')
    expect(names).toContain('implementation')
    expect(names).toContain('review')
  })

  it('setup phase has transition to implementation', async () => {
    const resp = await client.call('tools/call', {
      name: 'list_phases',
      arguments: { file: 'multi-phase.md' },
    })
    const result = resp.result as { phases: Array<{ name: string; transitions: Array<{ action: { name: string } }> }> }
    const setup = result.phases.find((p) => p.name === 'setup')
    expect(setup?.transitions[0]?.action.name).toBe('implementation')
  })

  it('review phase has no outgoing transitions', async () => {
    const resp = await client.call('tools/call', {
      name: 'list_phases',
      arguments: { file: 'multi-phase.md' },
    })
    const result = resp.result as { phases: Array<{ name: string; transitions: unknown[] }> }
    const review = result.phases.find((p) => p.name === 'review')
    expect(review?.transitions).toHaveLength(0)
  })
})

// ─── resolve_phase ────────────────────────────────────────────────────────────

describe('MCP E2E — tool: resolve_phase', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('resolves setup phase — includes phase-1.md content', async () => {
    const resp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'multi-phase.md', phase: 'setup' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { content: string }
    expect(result.content).toContain('Setup Phase')
    // @include resolved — macro call output present
    expect(result.content).toContain('Welcome to the setup phase')
    expect(result.content).not.toContain('@include')
  })

  it('resolves implementation phase — includes phase-2.md content', async () => {
    const resp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'multi-phase.md', phase: 'implementation' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { content: string }
    expect(result.content).toContain('Implementation Phase')
  })

  it('nonexistent phase returns well-formed error', async () => {
    const resp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'multi-phase.md', phase: 'nonexistent' },
    })
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
  })
})

// ─── next_phase ───────────────────────────────────────────────────────────────

describe('MCP E2E — tool: next_phase', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('setup → implementation', async () => {
    const resp = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'multi-phase.md', current_phase: 'setup' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { phase: string | null }
    expect(result.phase).toBe('implementation')
  })

  it('implementation → review', async () => {
    const resp = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'multi-phase.md', current_phase: 'implementation' },
    })
    const result = resp.result as { phase: string | null }
    expect(result.phase).toBe('review')
  })

  it('review → null (end of document)', async () => {
    const resp = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'multi-phase.md', current_phase: 'review' },
    })
    const result = resp.result as { phase: string | null }
    expect(result.phase).toBeNull()
  })
})

// ─── call_macro ───────────────────────────────────────────────────────────────

describe('MCP E2E — tool: call_macro', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('calls greet macro with name arg', async () => {
    const resp = await client.call('tools/call', {
      name: 'call_macro',
      arguments: { file: 'with-macros.md', macro: 'greet', args: { name: 'Claude' } },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { output: string }
    expect(result.output).toContain('Claude')
    expect(result.output).toContain('Welcome to MarkdownAI')
  })

  it('calls describe macro with two named args', async () => {
    const resp = await client.call('tools/call', {
      name: 'call_macro',
      arguments: {
        file: 'with-macros.md',
        macro: 'describe',
        args: { feature: 'TestFeature', detail: 'A test detail.' },
      },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { output: string; found: boolean }
    expect(result.found).toBe(true)
    expect(result.output).toContain('TestFeature')
    expect(result.output).toContain('A test detail.')
  })

  it('undefined macro returns well-formed result', async () => {
    const resp = await client.call('tools/call', {
      name: 'call_macro',
      arguments: { file: 'with-macros.md', macro: 'undefined_macro_xyz', args: {} },
    })
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
  })
})

// ─── get_env ──────────────────────────────────────────────────────────────────

describe('MCP E2E — tool: get_env', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('returns PATH (always set in any environment)', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_env',
      arguments: { key: 'PATH' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { value: string; found: boolean }
    expect(result.value.length).toBeGreaterThan(0)
  })

  it('returns fallback for unset variable', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_env',
      arguments: { key: 'DEFINITELY_NOT_SET_XYZ_TESTVAR', fallback: 'my-fallback' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { value: string }
    expect(result.value).toBe('my-fallback')
  })

  it('credential key (MONGO_PASSWORD) is denied', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_env',
      arguments: { key: 'MONGO_PASSWORD' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { value: string; denied?: boolean }
    expect(result.denied).toBe(true)
    expect(result.value).toBe('')
  })
})

// ─── execute_directive ────────────────────────────────────────────────────────

describe('MCP E2E — tool: execute_directive', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('@date format="YYYY" returns current year', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: '@date format="YYYY"' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { output: string }
    expect(result.output).toContain('2026')
  })

  it('@env with fallback returns fallback value', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: '@env MARKDOWNAI_TEST_UNSET_VAR fallback="test-value"' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { output: string }
    expect(result.output).toContain('test-value')
  })
})

// ─── invalidate_cache ─────────────────────────────────────────────────────────

describe('MCP E2E — tool: invalidate_cache', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('clears all cache, returns cleared status', async () => {
    const resp = await client.call('tools/call', {
      name: 'invalidate_cache',
      arguments: {},
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { cleared: { session: boolean; persist: boolean } }
    expect(typeof result.cleared.session).toBe('boolean')
    expect(typeof result.cleared.persist).toBe('boolean')
  })
})

// ─── PHASE WORKFLOW INTEGRATION ───────────────────────────────────────────────

describe('MCP E2E — phase workflow integration', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('full 3-phase traversal: list → resolve → next → resolve → next → resolve → next=null', async () => {
    // Step 1: list phases
    const listResp = await client.call('tools/call', {
      name: 'list_phases',
      arguments: { file: 'multi-phase.md' },
    })
    expect(listResp.error).toBeUndefined()
    const phases = (listResp.result as { phases: Array<{ name: string }> }).phases
    expect(phases.map((p) => p.name)).toEqual(['setup', 'implementation', 'review'])

    // Step 2: resolve setup
    const setupResp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'multi-phase.md', phase: 'setup' },
    })
    expect(setupResp.error).toBeUndefined()
    expect((setupResp.result as { content: string }).content).toContain('Setup Phase')

    // Step 3: next after setup
    const nextAfterSetup = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'multi-phase.md', current_phase: 'setup' },
    })
    expect((nextAfterSetup.result as { phase: string }).phase).toBe('implementation')

    // Step 4: resolve implementation
    const implResp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'multi-phase.md', phase: 'implementation' },
    })
    expect(implResp.error).toBeUndefined()
    expect((implResp.result as { content: string }).content).toContain('Implementation Phase')

    // Step 5: next after implementation
    const nextAfterImpl = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'multi-phase.md', current_phase: 'implementation' },
    })
    expect((nextAfterImpl.result as { phase: string }).phase).toBe('review')

    // Step 6: resolve review
    const reviewResp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'multi-phase.md', phase: 'review' },
    })
    expect(reviewResp.error).toBeUndefined()
    expect((reviewResp.result as { content: string }).content).toContain('Review Phase')

    // Step 7: next after review → null
    const nextAfterReview = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'multi-phase.md', current_phase: 'review' },
    })
    expect((nextAfterReview.result as { phase: null }).phase).toBeNull()
  })
})
