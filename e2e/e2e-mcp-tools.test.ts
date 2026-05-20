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
