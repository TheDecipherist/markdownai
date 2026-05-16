import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { McpClient } from './helpers/mcp-helpers.js'
import { spawnMcpServer, MCP_FIXTURES } from './helpers/mcp-helpers.js'

// ─── AI FORMAT DEFAULT ─────────────────────────────────────────────────────────

describe('MCP AI — read_file returns ai-format by default', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('default read_file: no horizontal rules in output', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { content: string; isMarkdownAI: boolean }
    expect(result.isMarkdownAI).toBe(true)
    expect(result.content).not.toMatch(/^---+$/m)
    expect(result.content).not.toMatch(/^\*\*\*+$/m)
  })

  it('default read_file: @prompt renders with [AI INSTRUCTION] prefix', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    const result = resp.result as { content: string }
    expect(result.content).toContain('[AI INSTRUCTION — context]')
    expect(result.content).toContain('MarkdownAI rendering pipeline')
  })

  it('default read_file: no unresolved @prompt tokens', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    const result = resp.result as { content: string }
    expect(result.content).not.toContain('@prompt')
    expect(result.content).not.toContain('@end')
  })

  it('format=standard override returns longer output than ai default', async () => {
    const aiResp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    const stdResp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md', format: 'standard' },
    })
    const aiContent = (aiResp.result as { content: string }).content
    const stdContent = (stdResp.result as { content: string }).content
    expect(stdContent.length).toBeGreaterThan(aiContent.length)
  })
})

// ─── get_constraints ──────────────────────────────────────────────────────────

describe('MCP AI — get_constraints tool', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('returns 2 constraints from ai-native.md', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_constraints',
      arguments: { file: 'ai-native.md' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { constraints: Array<{ id: string; severity: string; body: string }>; isMarkdownAI: boolean }
    expect(result.isMarkdownAI).toBe(true)
    expect(result.constraints).toHaveLength(2)
    const ids = result.constraints.map((c) => c.id)
    expect(ids).toContain('no-eval')
    expect(ids).toContain('no-traversal')
  })

  it('constraints are sorted: critical first', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_constraints',
      arguments: { file: 'ai-native.md' },
    })
    const result = resp.result as { constraints: Array<{ severity: string }> }
    expect(result.constraints[0]?.severity).toBe('critical')
    expect(result.constraints[1]?.severity).toBe('critical')
  })

  it('no-eval constraint has correct body text', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_constraints',
      arguments: { file: 'ai-native.md' },
    })
    const result = resp.result as { constraints: Array<{ id: string; body: string }> }
    const noEval = result.constraints.find((c) => c.id === 'no-eval')
    expect(noEval?.body).toContain('eval()')
    expect(noEval?.body).toContain('vm.runInNewContext')
  })

  it('non-MarkdownAI file returns empty constraints array', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_constraints',
      arguments: { file: 'phases/phase-1.md' },
    })
    const result = resp.result as { constraints: unknown[]; isMarkdownAI: boolean }
    // phase-1.md is MarkdownAI but has no @constraint blocks
    expect(result.constraints).toHaveLength(0)
  })
})

// ─── GLOSSARY IN MCP RESPONSE ─────────────────────────────────────────────────

describe('MCP AI — @define-concept glossary in MCP response', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('glossary block appears at document top before content', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    const result = resp.result as { content: string }
    const glossaryIdx = result.content.indexOf('## Glossary')
    const coreIdx = result.content.indexOf('## Core Architecture')
    expect(glossaryIdx).toBeGreaterThanOrEqual(0)
    expect(coreIdx).toBeGreaterThan(glossaryIdx)
  })

  it('jailRoot and strictMode definitions are in the glossary', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    const result = resp.result as { content: string }
    expect(result.content).toContain('jailRoot')
    expect(result.content).toContain('strictMode')
  })
})

// ─── CONTEXT BUDGET VIA MCP ───────────────────────────────────────────────────

describe('MCP AI — context budget via read_file', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('budget=50 drops low-priority section', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md', budget: 50 },
    })
    const result = resp.result as { content: string }
    expect(result.content).not.toContain('Historical Background')
  })

  it('budget=50 preserves critical section', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md', budget: 50 },
    })
    const result = resp.result as { content: string }
    expect(result.content).toContain('Core Architecture')
  })

  it('budget=1 keeps only critical sections', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md', budget: 1 },
    })
    const result = resp.result as { content: string }
    expect(result.content).toContain('Core Architecture')
    expect(result.content).not.toContain('Historical Background')
  })
})

// ─── REALISTIC MULTI-TURN WORKFLOW ────────────────────────────────────────────

describe('MCP AI — realistic 10-step Claude workflow', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('completes full 10-step Claude session without error', async () => {
    // Step 1+2: tools/list — verify get_constraints is present
    const listResp = await client.call('tools/list', {})
    expect(listResp.error).toBeUndefined()
    const toolNames = (listResp.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name)
    expect(toolNames).toContain('get_constraints')

    // Step 3: read_file — ai-format rendered output
    const readResp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: 'ai-native.md' },
    })
    expect(readResp.error).toBeUndefined()
    const readResult = readResp.result as { content: string; isMarkdownAI: boolean }
    expect(readResult.isMarkdownAI).toBe(true)
    expect(readResult.content).toContain('[AI INSTRUCTION — context]')
    expect(readResult.content).toContain('## Glossary')
    expect(readResult.content).toContain('## Constraints')

    // Step 4: get_constraints
    const constraintsResp = await client.call('tools/call', {
      name: 'get_constraints',
      arguments: { file: 'ai-native.md' },
    })
    expect(constraintsResp.error).toBeUndefined()
    const constraints = (constraintsResp.result as { constraints: Array<{ id: string; severity: string }> }).constraints
    expect(constraints).toHaveLength(2)
    expect(constraints[0]?.id).toBe('no-eval')
    expect(constraints[1]?.id).toBe('no-traversal')

    // Step 5: list_phases
    const phasesResp = await client.call('tools/call', {
      name: 'list_phases',
      arguments: { file: 'ai-native.md' },
    })
    expect(phasesResp.error).toBeUndefined()
    const phasesList = (phasesResp.result as { phases: Array<{ name: string }> }).phases
    expect(phasesList.map((p) => p.name)).toContain('implementation')
    expect(phasesList.map((p) => p.name)).toContain('review')

    // Step 6: resolve implementation phase
    const implResp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'ai-native.md', phase: 'implementation' },
    })
    expect(implResp.error).toBeUndefined()
    expect((implResp.result as { content: string }).content).toContain('Implementation Phase')

    // Step 7: next_phase after implementation
    const nextImplResp = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'ai-native.md', current_phase: 'implementation' },
    })
    expect(nextImplResp.error).toBeUndefined()
    expect((nextImplResp.result as { phase: string }).phase).toBe('review')

    // Step 8: resolve review phase
    const reviewResp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: 'ai-native.md', phase: 'review' },
    })
    expect(reviewResp.error).toBeUndefined()
    expect((reviewResp.result as { content: string }).content).toContain('Review Phase')

    // Step 9: next_phase after review → null
    const nextReviewResp = await client.call('tools/call', {
      name: 'next_phase',
      arguments: { file: 'ai-native.md', current_phase: 'review' },
    })
    expect(nextReviewResp.error).toBeUndefined()
    expect((nextReviewResp.result as { phase: null }).phase).toBeNull()

    // Step 10: invalidate_cache
    const cacheResp = await client.call('tools/call', {
      name: 'invalidate_cache',
      arguments: {},
    })
    expect(cacheResp.error).toBeUndefined()
    const cacheResult = cacheResp.result as { cleared: { session: boolean; persist: boolean } }
    expect(typeof cacheResult.cleared.session).toBe('boolean')
  })
})
