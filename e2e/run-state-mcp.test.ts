import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn as spawnAsync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function dist(pkg: string, entry = 'index.js'): string {
  return join(ROOT, 'packages', pkg, 'dist', entry)
}

const TMP = join(tmpdir(), 'markdownai-run-state-mcp')
const FIXTURE = join(TMP, 'fixture.md')
const MACRO_FIXTURE = join(TMP, 'macro.md')
const PHASE_FIXTURE = join(TMP, 'phases.md')
const CONSTRAINT_FIXTURE = join(TMP, 'constraint.md')

beforeAll(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(FIXTURE, '@markdownai v1.0\n\n# Hello\n\nWorld\n')
  writeFileSync(MACRO_FIXTURE, '@markdownai v1.0\n\n@define greet(name)\nHello {{ name }}\n@end\n')
  writeFileSync(PHASE_FIXTURE, '@markdownai v1.0\n\n@phase setup\nSetup content\n@on complete -> @phase main\n@end\n\n@phase main\nMain content\n@end\n')
  writeFileSync(CONSTRAINT_FIXTURE, '@markdownai v1.0\n\n@constraint[critical] No secrets in output\n')
})

afterAll(() => { rmSync(TMP, { recursive: true, force: true }) })

describe('@markdownai/mcp — run state', () => {

  // ── Implemented ──────────────────────────────────────────────────────────────

  it('dist/index.js resolves and exports startServer()', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.startServer).toBe('function')
  })

  it('mai-serve binary starts and responds to a JSON-RPC tools/list request', async () => {
    await new Promise<void>((resolve, reject) => {
      const proc = spawnAsync(process.execPath, [dist('mcp', 'server.js')], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      let stdout = ''
      const timeout = setTimeout(() => { proc.kill(); reject(new Error('MCP server did not respond within 3s')) }, 3000)
      proc.stdout!.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
        const line = stdout.split('\n').find(l => l.trim().startsWith('{'))
        if (!line) return
        clearTimeout(timeout)
        proc.kill()
        try {
          const resp = JSON.parse(line)
          expect(resp.jsonrpc).toBe('2.0')
          expect(resp.id).toBe(1)
          resolve()
        } catch (e) { reject(e) }
      })
      proc.on('error', (e) => { clearTimeout(timeout); reject(e) })
      proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\n')
    })
  })

  // ── Skeletons ────────────────────────────────────────────────────────────────

  it('readFile is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.readFile).toBe('function')
  })

  it('listPhases is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.listPhases).toBe('function')
  })

  it('listPhases() returns phases for a phase fixture', async () => {
    const { listPhases } = await import(dist('mcp'))
    const result = await listPhases('phases.md', TMP)
    expect(result).not.toHaveProperty('error')
    expect(Array.isArray(result.phases)).toBe(true)
  })

  it('resolvePhase is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.resolvePhase).toBe('function')
  })

  it('resolvePhase() returns content for an existing phase', async () => {
    const { resolvePhase } = await import(dist('mcp'))
    const result = await resolvePhase('phases.md', 'setup', TMP)
    expect(result).toBeTypeOf('object')
    expect(result).toHaveProperty('found')
  })

  it('nextPhase is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.nextPhase).toBe('function')
  })

  it('nextPhase() returns next phase name', async () => {
    const { nextPhase } = await import(dist('mcp'))
    const result = await nextPhase('phases.md', 'setup', TMP)
    expect(result).toBeTypeOf('object')
    expect(result).toHaveProperty('phase')
  })

  it('callMacro is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.callMacro).toBe('function')
  })

  it('callMacro() returns output for a defined macro', async () => {
    const { callMacro } = await import(dist('mcp'))
    const result = await callMacro('macro.md', 'greet', { name: 'World' }, TMP)
    expect(result).toBeTypeOf('object')
    expect(result).toHaveProperty('found')
  })

  it('getEnv is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.getEnv).toBe('function')
  })

  it('getEnv() returns PATH value', async () => {
    const { getEnv } = await import(dist('mcp'))
    const result = await getEnv('PATH')
    expect(result.found).toBe(true)
    expect(typeof result.value).toBe('string')
    expect(result.value.length).toBeGreaterThan(0)
  })

  it('executeDirective is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.executeDirective).toBe('function')
  })

  it('invalidateCache is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.invalidateCache).toBe('function')
  })

  it('invalidateCache() clears cache without error', async () => {
    const { invalidateCache } = await import(dist('mcp'))
    const result = await invalidateCache()
    expect(result).not.toHaveProperty('error')
    expect(result.cleared.session).toBe(true)
  })

  it('getConstraints is a function', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.getConstraints).toBe('function')
  })

  it('getConstraints() returns constraints from fixture', async () => {
    const { getConstraints } = await import(dist('mcp'))
    const result = await getConstraints('constraint.md', TMP)
    expect(result).toBeTypeOf('object')
    expect(Array.isArray(result.constraints)).toBe(true)
  })

  it('registerConnection / getConnection / listConnections / clearConnections all exported', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.registerConnection).toBe('function')
    expect(typeof mod.getConnection).toBe('function')
    expect(typeof mod.listConnections).toBe('function')
    expect(typeof mod.clearConnections).toBe('function')
  })

  it('connection lifecycle: register -> get -> list -> clear', async () => {
    const { registerConnection, getConnection, listConnections, clearConnections } = await import(dist('mcp'))
    await registerConnection('test-db', 'postgres', { host: 'localhost' }, 'test-session')
    const conn = await getConnection('test-db', 'test-session')
    expect(conn).not.toBeNull()
    const listed = await listConnections('test-session')
    expect(listed.length).toBe(1)
    await clearConnections('test-session')
    const afterClear = await listConnections('test-session')
    expect(afterClear.length).toBe(0)
  })
})
