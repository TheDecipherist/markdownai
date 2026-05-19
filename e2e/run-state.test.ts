import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync, spawn as spawnAsync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function dist(pkg: string, entry = 'index.js'): string {
  return join(ROOT, 'packages', pkg, 'dist', entry)
}

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [dist('core', 'cli.js'), ...args], { encoding: 'utf-8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

const TMP = join(tmpdir(), 'markdownai-run-state')
const FIXTURE = join(TMP, 'fixture.md')

mkdirSync(TMP, { recursive: true })
writeFileSync(FIXTURE, '@markdownai v1.0\n\n# Hello\n\nWorld\n')

afterAll(() => { rmSync(TMP, { recursive: true, force: true }) })

// ─── @markdownai/parser ───────────────────────────────────────────────────────

describe('@markdownai/parser — run state', () => {
  it('dist/index.js resolves and exports parse()', async () => {
    const mod = await import(dist('parser'))
    expect(typeof mod.parse).toBe('function')
  })

  it('parse() returns an AST with nodes for a valid document', async () => {
    const { parse } = await import(dist('parser'))
    const result = parse('@markdownai v1.0\n\nHello world')
    expect(result).toBeDefined()
    expect(Array.isArray(result.nodes)).toBe(true)
    expect(result.nodes.length).toBeGreaterThan(0)
  })

  it('parse() does not throw on a plain markdown document', async () => {
    const { parse } = await import(dist('parser'))
    expect(() => parse('# Just markdown\n\nNo directives.')).not.toThrow()
  })
})

// ─── @markdownai/renderer ────────────────────────────────────────────────────

describe('@markdownai/renderer — run state', () => {
  it('dist/index.js resolves and exports render()', async () => {
    const mod = await import(dist('renderer'))
    expect(typeof mod.render).toBe('function')
  })

  it('render() returns a non-empty string for valid input', async () => {
    const { render } = await import(dist('renderer'))
    const output = render({ type: 'list', data: ['alpha', 'beta', 'gamma'] })
    expect(typeof output).toBe('string')
    expect(output.length).toBeGreaterThan(0)
    expect(output).toContain('alpha')
  })
})

// ─── @markdownai/engine ──────────────────────────────────────────────────────

describe('@markdownai/engine — run state', () => {
  it('dist/index.js resolves and exports execute()', async () => {
    const mod = await import(dist('engine'))
    expect(typeof mod.execute).toBe('function')
  })

  it('execute() returns an EngineResult with output string', async () => {
    const { parse } = await import(dist('parser'))
    const { execute } = await import(dist('engine'))
    const ast = parse('@markdownai v1.0\n\n# Test\n\nHello')
    const result = execute(ast)
    expect(typeof result.output).toBe('string')
    expect(Array.isArray(result.errors)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('execute() does not throw on a minimal document', async () => {
    const { parse } = await import(dist('parser'))
    const { execute } = await import(dist('engine'))
    const ast = parse('@markdownai v1.0\n\nHello')
    expect(() => execute(ast)).not.toThrow()
  })
})

// ─── @markdownai/mcp ─────────────────────────────────────────────────────────

describe('@markdownai/mcp — run state', () => {
  it('dist/index.js resolves and exports startServer()', async () => {
    const mod = await import(dist('mcp'))
    expect(typeof mod.startServer).toBe('function')
  })

  it('mai serve starts and responds to a JSON-RPC tools/list request', async () => {
    await new Promise<void>((resolve, reject) => {
      const proc = spawnAsync(process.execPath, [dist('core', 'cli.js'), 'serve'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      const timeout = setTimeout(() => {
        proc.kill()
        reject(new Error('MCP server did not respond within 3s'))
      }, 3000)

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
        } catch (e) {
          reject(e)
        }
      })

      proc.on('error', (e) => { clearTimeout(timeout); reject(e) })
      proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) + '\n')
    })
  })
})

// ─── @markdownai/core ────────────────────────────────────────────────────────

describe('@markdownai/core — run state', () => {
  it('mai --version exits 0 and prints a semantic version', () => {
    const r = cli(['--version'])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/\d+\.\d+\.\d+/)
  })

  it('mai --help exits 0 and lists core commands', () => {
    const r = cli(['--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('render')
    expect(r.stdout).toContain('strip')
    expect(r.stdout).toContain('validate')
  })

  it('mai render --help exits 0 and shows universal flags', () => {
    const r = cli(['render', '--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('--env')
    expect(r.stdout).toContain('--cwd')
    expect(r.stdout).toContain('--verbose')
  })

  it('mai render exits 0 on a valid @markdownai document', () => {
    const r = cli(['render', FIXTURE])
    expect(r.status).toBe(0)
    expect(r.stdout.trim().length).toBeGreaterThan(0)
    expect(r.stdout).toContain('Hello')
  })

  it('mai strip exits 0 on a valid @markdownai document', () => {
    const r = cli(['strip', FIXTURE])
    expect(r.status).toBe(0)
    expect(r.stdout).not.toContain('@markdownai')
  })

  it('mai validate exits 0 on a valid @markdownai document', () => {
    const r = cli(['validate', FIXTURE])
    expect(r.status).toBe(0)
  })
})
