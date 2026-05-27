import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { McpClient } from './helpers/mcp-helpers.js'
import { spawnMcpServer, MCP_FIXTURES } from './helpers/mcp-helpers.js'

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

  it('@date format="YYYY" returns current year /', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: '@date format="YYYY" /' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { output: string }
    expect(result.output).toContain('2026')
  })

  it('@env with fallback returns fallback value /', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: '@env MARKDOWNAI_TEST_UNSET_VAR fallback="test-value" /' },
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
