import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { McpClient } from './helpers/mcp-helpers.js'
import { spawnMcpServer, MCP_FIXTURES } from './helpers/mcp-helpers.js'

async function assertAlive(client: McpClient): Promise<void> {
  const resp = await client.call('tools/call', {
    name: 'get_env',
    arguments: { key: 'PATH' },
  })
  expect(resp.error).toBeUndefined()
  const result = resp.result as { value: string }
  expect(result.value.length).toBeGreaterThan(0)
}

// ─── PATH TRAVERSAL — read_file ───────────────────────────────────────────────

describe('MCP Security — path traversal via read_file', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('blocks ../../../etc/passwd traversal', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: '../../../etc/passwd' },
    })
    const result = resp.result as { content: string; warnings: string[] }
    expect(result.content).toBe('')
    expect(result.warnings.some((w: string) => w.toLowerCase().includes('traversal') || w.toLowerCase().includes('blocked'))).toBe(true)
    await assertAlive(client)
  })

  it('blocks absolute path /etc/passwd', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: '/etc/passwd' },
    })
    const result = resp.result as { content: string; warnings: string[] }
    expect(result.content).toBe('')
    await assertAlive(client)
  })

  it('blocks traversal to project source files', async () => {
    const resp = await client.call('tools/call', {
      name: 'read_file',
      arguments: { path: '../../packages/core/src/cli.ts' },
    })
    const result = resp.result as { content: string }
    expect(result.content).toBe('')
    await assertAlive(client)
  })

  it('server remains alive after multiple traversal attempts', async () => {
    for (const path of ['../../../etc/shadow', '/root/.ssh/id_rsa', '../../.env']) {
      await client.call('tools/call', { name: 'read_file', arguments: { path } })
    }
    await assertAlive(client)
  })
})

// ─── PATH TRAVERSAL — resolve_phase ──────────────────────────────────────────

describe('MCP Security — path traversal via resolve_phase', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('blocks ../../../etc/shadow as file arg', async () => {
    const resp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: '../../../etc/shadow', phase: 'any' },
    })
    // Must be error or empty result — not content of /etc/shadow
    const result = resp.result as { content?: string; error?: string }
    expect(result.content ?? '').toBe('')
    await assertAlive(client)
  })

  it('blocks absolute path in file arg', async () => {
    const resp = await client.call('tools/call', {
      name: 'resolve_phase',
      arguments: { file: '/etc/hosts', phase: 'any' },
    })
    const result = resp.result as { content?: string }
    expect(result.content ?? '').toBe('')
    await assertAlive(client)
  })
})

// ─── CREDENTIAL FILTERING — get_env ──────────────────────────────────────────

describe('MCP Security — credential filtering via get_env', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  const deniedKeys = ['MONGO_PASSWORD', 'AWS_SECRET_ACCESS_KEY', 'API_KEY', 'DATABASE_URL', 'PRIVATE_KEY', 'AUTH_TOKEN']

  for (const key of deniedKeys) {
    it(`blocks sensitive key: ${key}`, async () => {
      const resp = await client.call('tools/call', {
        name: 'get_env',
        arguments: { key },
      })
      expect(resp.error).toBeUndefined()
      const result = resp.result as { value: string; denied?: boolean }
      expect(result.value).toBe('')
      expect(result.denied).toBe(true)
    })
  }

  it('allows safe keys: NODE_ENV', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_env',
      arguments: { key: 'NODE_ENV' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { denied?: boolean }
    expect(result.denied).toBeFalsy()
  })

  it('allows safe keys: PATH', async () => {
    const resp = await client.call('tools/call', {
      name: 'get_env',
      arguments: { key: 'PATH' },
    })
    expect(resp.error).toBeUndefined()
    const result = resp.result as { denied?: boolean; value: string }
    expect(result.denied).toBeFalsy()
    expect(result.value.length).toBeGreaterThan(0)
  })
})

// ─── INPUT SANITIZATION — execute_directive ───────────────────────────────────

describe('MCP Security — input sanitization via execute_directive', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('malformed non-directive input produces error, server stays alive', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: "'; process.exit(1); //" },
    })
    // Must not crash — either error code or result with warning
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
    await assertAlive(client)
  })

  it('empty directive produces well-formed error result', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: '' },
    })
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
    await assertAlive(client)
  })

  it('@env with credential key is filtered', async () => {
    const resp = await client.call('tools/call', {
      name: 'execute_directive',
      arguments: { directive: '@env MONGO_PASSWORD' },
    })
    // Either filtered or error — the actual credential value must not appear
    const respStr = JSON.stringify(resp)
    const actualPassword = process.env['MONGO_PASSWORD']
    if (actualPassword) {
      expect(respStr).not.toContain(actualPassword)
    }
    await assertAlive(client)
  })
})

// ─── INPUT SANITIZATION — call_macro ─────────────────────────────────────────

describe('MCP Security — input sanitization via call_macro', () => {
  let client: McpClient

  beforeAll(async () => {
    client = await spawnMcpServer(MCP_FIXTURES)
  })

  afterAll(async () => {
    await client.close()
  })

  it('file path traversal in call_macro is blocked', async () => {
    const resp = await client.call('tools/call', {
      name: 'call_macro',
      arguments: { file: '../../escape.md', macro: 'name', args: {} },
    })
    const result = resp.result as { output?: string; error?: string }
    expect(result.output ?? '').toBe('')
    await assertAlive(client)
  })

  it('SQL-injection-style macro name produces error, no crash', async () => {
    const resp = await client.call('tools/call', {
      name: 'call_macro',
      arguments: { file: 'with-macros.md', macro: "'; DROP TABLE--", args: {} },
    })
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
    await assertAlive(client)
  })

  it('empty macro name produces well-formed result', async () => {
    const resp = await client.call('tools/call', {
      name: 'call_macro',
      arguments: { file: 'with-macros.md', macro: '', args: {} },
    })
    const isResult = resp.result != null
    const isError = resp.error != null
    expect(isResult || isError).toBe(true)
    await assertAlive(client)
  })
})
