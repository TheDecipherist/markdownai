import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../commands/init.js'

// runInit's homeDir option redirects all filesystem writes into a tmp dir
// so the real ~/.claude/ and ~/.markdownai/ stay untouched.
let workDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'mai-init-mcp-'))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

describe('runInit — MCP server registration', () => {
  it('registers @markdownai/mcp (via mai-serve) in ~/.claude.json on a fresh install', () => {
    const result = runInit({ client: 'claude-code', homeDir: workDir })

    expect(result.success).toBe(true)
    expect(result.mcpConfigPath).toBe(join(workDir, '.claude.json'))
    expect(result.mcpRegistration).toEqual({
      serverName: 'markdownai',
      command: 'mai-serve',
      alreadyInstalled: false,
    })

    const config = readJson(join(workDir, '.claude.json'))
    const mcpServers = config['mcpServers'] as Record<string, unknown>
    expect(mcpServers['markdownai']).toEqual({ command: 'mai-serve', args: [] })
    expect(result.message).toContain('@markdownai/mcp registered in')
  })

  it('preserves existing mcpServers entries when adding markdownai', () => {
    mkdirSync(workDir, { recursive: true })
    writeFileSync(
      join(workDir, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
        },
      }),
    )

    const result = runInit({ client: 'claude-code', homeDir: workDir })

    expect(result.success).toBe(true)
    const config = readJson(join(workDir, '.claude.json'))
    const mcpServers = config['mcpServers'] as Record<string, unknown>
    // Existing entry untouched
    expect(mcpServers['context7']).toEqual({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
    })
    // New entry added
    expect(mcpServers['markdownai']).toEqual({ command: 'mai-serve', args: [] })
  })

  it('reports alreadyInstalled when an @markdownai/mcp entry is already present', () => {
    mkdirSync(workDir, { recursive: true })
    writeFileSync(
      join(workDir, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          markdownai: { command: 'npx', args: ['-y', '@markdownai/mcp'] },
        },
      }),
    )

    const result = runInit({ client: 'claude-code', homeDir: workDir })
    expect(result.mcpRegistration?.alreadyInstalled).toBe(true)
    // The pre-existing npx-based entry is preserved (we don't churn entries
    // that already point at MarkdownAI).
    const config = readJson(join(workDir, '.claude.json'))
    const mcpServers = config['mcpServers'] as Record<string, unknown>
    expect(mcpServers['markdownai']).toEqual({
      command: 'npx',
      args: ['-y', '@markdownai/mcp'],
    })
  })

  it('recognizes a server registered under a non-default name when matched by package', () => {
    mkdirSync(workDir, { recursive: true })
    writeFileSync(
      join(workDir, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          'mai-custom-name': { command: 'mai-serve' },
        },
      }),
    )

    const result = runInit({ client: 'claude-code', homeDir: workDir })
    // The function only deduplicates on the canonical 'markdownai' key, so a
    // different name is treated as a separate entry. The new 'markdownai'
    // entry is added; the user's custom-named one is preserved.
    const config = readJson(join(workDir, '.claude.json'))
    const mcpServers = config['mcpServers'] as Record<string, unknown>
    expect(Object.keys(mcpServers).sort()).toEqual(['mai-custom-name', 'markdownai'])
    expect(result.mcpRegistration?.alreadyInstalled).toBe(false)
  })

  it('creates ~/.claude.json when it does not exist yet', () => {
    const result = runInit({ client: 'claude-code', homeDir: workDir })

    expect(result.success).toBe(true)
    expect(result.mcpRegistration?.alreadyInstalled).toBe(false)
    const config = readJson(join(workDir, '.claude.json'))
    expect(config['mcpServers']).toBeDefined()
  })

  it('skips MCP registration for cursor clients (cursor uses .cursor/mcp.json)', () => {
    const result = runInit({ client: 'cursor', homeDir: workDir })

    expect(result.success).toBe(true)
    expect(result.mcpRegistration).toBeUndefined()
    expect(result.mcpConfigPath).toBeUndefined()
    expect(result.message).not.toContain('@markdownai/mcp registered')
  })

  it('reports the MCP error when the existing ~/.claude.json is malformed JSON', () => {
    mkdirSync(workDir, { recursive: true })
    writeFileSync(join(workDir, '.claude.json'), '{ not valid')

    const result = runInit({ client: 'claude-code', homeDir: workDir })
    // The hook install still succeeds; the MCP step surfaces its error
    // alongside without aborting the whole init.
    expect(result.success).toBe(true)
    expect(result.mcpRegistration?.error).toContain('Cannot parse Claude config')
    expect(result.message).toContain('MCP registration failed')
  })
})
