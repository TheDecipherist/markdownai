import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function dist(pkg: string, entry = 'index.js'): string {
  return join(ROOT, 'packages', pkg, 'dist', entry)
}

const CLI = dist('core', 'cli.js')

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

const TMP = join(tmpdir(), 'markdownai-run-state-core')
const FIXTURE = join(TMP, 'fixture.md')

beforeAll(() => {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(FIXTURE, '@markdownai v1.0\n\n# Hello\n\nWorld\n')
})

afterAll(() => { rmSync(TMP, { recursive: true, force: true }) })

const UNIVERSAL_FLAGS = ['--env', '--cwd', '--verbose', '--strict', '--silent']
const ALL_CMDS = ['render', 'validate', 'parse', 'eval', 'strip', 'build', 'watch', 'serve', 'init', 'list-phases', 'list-macros', 'list-imports']

describe('@markdownai/core — run state', () => {

  // ── Implemented ──────────────────────────────────────────────────────────────

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

  // ── render (additional flags) ─────────────────────────────────────────────

  it('mai render --consumer ai exits 0', () => {
    const r = cli(['render', '--consumer', 'ai', FIXTURE])
    expect(r.status).toBe(0)
  })

  it('mai render --format ai exits 0', () => {
    const r = cli(['render', '--format', 'ai', FIXTURE])
    expect(r.status).toBe(0)
  })

  it('mai render -o <outfile> writes file', () => {
    const outFile = join(TMP, 'out.md')
    const r = cli(['render', '-o', outFile, FIXTURE])
    expect(r.status).toBe(0)
    expect(existsSync(outFile)).toBe(true)
  })

  // ── validate ─────────────────────────────────────────────────────────────

  it('mai validate --help shows universal flags', () => {
    const r = cli(['validate', '--help'])
    expect(r.stdout).toContain('--env')
    expect(r.stdout).toContain('--cwd')
  })

  // ── parse ─────────────────────────────────────────────────────────────────

  it('mai parse --help exits 0', () => {
    const r = cli(['parse', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai parse <file> outputs JSON', () => {
    const r = cli(['parse', FIXTURE])
    expect(r.status).toBe(0)
    const parsed = JSON.parse(r.stdout)
    expect('nodes' in parsed || 'isMarkdownAI' in parsed).toBe(true)
  })

  it('mai parse <file> --pretty exits 0', () => {
    const r = cli(['parse', FIXTURE, '--pretty'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('{')
  })

  // ── eval ──────────────────────────────────────────────────────────────────

  it('mai eval --help exits 0', () => {
    const r = cli(['eval', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai eval "1+1" outputs result', () => {
    const r = cli(['eval', '1+1'])
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe('2')
  })

  // ── strip ─────────────────────────────────────────────────────────────────

  it('mai strip --help shows universal flags', () => {
    const r = cli(['strip', '--help'])
    expect(r.stdout).toContain('--env')
  })

  // ── build ─────────────────────────────────────────────────────────────────

  it('mai build --help exits 0', () => {
    const r = cli(['build', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai build <file> -o <out> writes output file', () => {
    const r = cli(['build', FIXTURE, '--cwd', TMP, '-o', 'built.md'])
    expect(r.status).toBe(0)
    expect(existsSync(join(TMP, 'built.md'))).toBe(true)
  })

  // ── watch ─────────────────────────────────────────────────────────────────

  it('mai watch --help exits 0', () => {
    const r = cli(['watch', '--help'])
    expect(r.status).toBe(0)
  })

  // ── serve ─────────────────────────────────────────────────────────────────

  it('mai serve --help exits 0', () => {
    const r = cli(['serve', '--help'])
    expect(r.status).toBe(0)
  })

  // ── init ──────────────────────────────────────────────────────────────────

  it('mai init --help exits 0', () => {
    const r = cli(['init', '--help'])
    expect(r.status).toBe(0)
  })

  // ── cache ─────────────────────────────────────────────────────────────────

  it('mai cache --help exits 0', () => {
    const r = cli(['cache', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai cache show exits 0', () => {
    const r = cli(['cache', 'show'])
    expect(r.status).toBe(0)
  })

  it('mai cache show --help exits 0', () => {
    const r = cli(['cache', 'show', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai cache clear --session exits 0', () => {
    const r = cli(['cache', 'clear', '--session'])
    expect(r.status).toBe(0)
  })

  it('mai cache clear --help exits 0', () => {
    const r = cli(['cache', 'clear', '--help'])
    expect(r.status).toBe(0)
  })

  // ── list-phases / list-macros / list-imports ──────────────────────────────

  it('mai list-phases --help exits 0', () => {
    const r = cli(['list-phases', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai list-phases <file> exits 0', () => {
    const r = cli(['list-phases', FIXTURE])
    expect(r.status).toBe(0)
  })

  it('mai list-macros --help exits 0', () => {
    const r = cli(['list-macros', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai list-macros <file> exits 0', () => {
    const r = cli(['list-macros', FIXTURE])
    expect(r.status).toBe(0)
  })

  it('mai list-imports --help exits 0', () => {
    const r = cli(['list-imports', '--help'])
    expect(r.status).toBe(0)
  })

  it('mai list-imports <file> exits 0', () => {
    const r = cli(['list-imports', FIXTURE])
    expect(r.status).toBe(0)
  })

  // ── universal flags sweep ─────────────────────────────────────────────────

  it('every command --help shows --env --cwd --verbose --strict --silent', () => {
    const failures: string[] = []
    for (const cmd of ALL_CMDS) {
      const r = cli([cmd, '--help'])
      for (const flag of UNIVERSAL_FLAGS) {
        if (!r.stdout.includes(flag)) {
          failures.push(`${cmd}: missing ${flag}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
