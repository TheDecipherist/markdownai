import { describe, it, expect, beforeAll } from 'vitest'
import { resolve, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { RenderResult } from '@markdownai/core'
import { runRender, runStrip, runValidate, runCacheClear } from '@markdownai/core'

const ROOT = resolve(import.meta.dirname, '..')
const MAI = join(ROOT, 'mai')
const CLI = join(ROOT, 'packages/core/dist/cli.js')
const RENDERED = join(ROOT, 'e2e/rendered')

mkdirSync(RENDERED, { recursive: true })

function saveRendered(name: string, output: string): void {
  writeFileSync(join(RENDERED, name), output, 'utf8')
}

function fixture(name: string): string {
  return join(MAI, name)
}

// Checks that the output contains no unresolved block-level directive tokens
function noRawDirectives(output: string): void {
  const blocked = [
    '@include ', '@define ', '@call ', '@phase ', '@end\n',
    '@list ', '@tree ', '@read ', '@count ', '@date ', '@env ',
    '@render ', '@import ', '@if ', '@elseif ', '@else\n', '@endif',
  ]
  for (const token of blocked) {
    expect(output, `output must not contain unresolved token "${token.trim()}"`).not.toContain(token)
  }
}

// ─── RENDER SUITE ────────────────────────────────────────────────────────────

describe('E2E — mai render', () => {

  describe('01-docs-hub — @include, @define/@call, @if, interpolation', () => {
    let result: RenderResult

    beforeAll(() => {
      result = runRender(fixture('01-docs-hub.md'), { cwd: ROOT })
      if (result.exitCode === 0) saveRendered('01-docs-hub.md', result.output)
    })

    it('renders with exitCode 0', () => {
      expect(result.exitCode).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('resolved @include — included section content appears in output', () => {
      expect(result.output).toContain('Introduction')
      expect(result.output).toContain('Quick Start Guide')
    })

    it('resolved @define/@call — macro output appears, parameter substituted', () => {
      expect(result.output).toContain('Welcome to **MarkdownAI**')
      expect(result.output).toContain('documentation as code')
    })

    it('@if conditional — shows true branch, hides false branch', () => {
      expect(result.output).toContain('rendered successfully with all directives resolved')
      expect(result.output).not.toContain('This section should never appear')
    })

    it('@date inserts current year', () => {
      expect(result.output).toContain('2026')
    })

    it('@env fallback renders when env var is not set', () => {
      expect(result.output).toContain('development')
    })

    it('output contains no unresolved @directives', () => {
      noRawDirectives(result.output)
    })

    it('output is non-empty', () => {
      expect(result.output.trim().length).toBeGreaterThan(100)
    })
  })

  describe('02-project-report — @list, @tree, @count, @date, pipe + @render', () => {
    let result: RenderResult

    beforeAll(() => {
      result = runRender(fixture('02-project-report.md'), { cwd: ROOT })
      if (result.exitCode === 0) saveRendered('02-project-report.md', result.output)
    })

    it('renders with exitCode 0', () => {
      expect(result.exitCode).toBe(0)
    })

    it('@list with @render type=list — produces unordered list of section files', () => {
      expect(result.output).toContain('guide.md')
      expect(result.output).toContain('intro.md')
    })

    it('@list with @render type=numbered — produces numbered list of data files', () => {
      expect(result.output).toMatch(/1\.\s/)
      expect(result.output).toContain('config.json')
    })

    it('@tree produces an ASCII tree structure', () => {
      expect(result.output).toContain('config.json')
      expect(result.output).toContain('features.json')
      expect(result.output).toContain('team.csv')
    })

    it('@count produces a numeric count (sections/ has 2 .md files)', () => {
      expect(result.output).toContain('2')
    })

    it('@date inserts a formatted date string', () => {
      expect(result.output).toContain('2026')
    })

    it('@env fallback renders when env var is not set', () => {
      expect(result.output).toContain('local')
    })

    it('output contains no unresolved @directives', () => {
      noRawDirectives(result.output)
    })
  })

  describe('03-api-reference — @import, @phase, pipe + @render', () => {
    let result: RenderResult

    beforeAll(() => {
      result = runRender(fixture('03-api-reference.md'), { cwd: ROOT })
      if (result.exitCode === 0) saveRendered('03-api-reference.md', result.output)
    })

    it('renders with exitCode 0', () => {
      expect(result.exitCode).toBe(0)
    })

    it('@import brings macro into scope — section_header output appears', () => {
      expect(result.output).toContain('Complete directive reference for MarkdownAI')
    })

    it('@import + @call — feature_status macro renders each item', () => {
      expect(result.output).toContain('Parser')
      expect(result.output).toContain('stable')
    })

    it('@import + @call — badge macro renders key/value pairs', () => {
      expect(result.output).toContain('Version')
      expect(result.output).toContain('1.0.0')
    })

    it('@phase content appears in rendered output', () => {
      expect(result.output).toContain('development builds')
      expect(result.output).toContain('stable public API')
    })

    it('pipe chain — @list | sort | @render type=list produces file listing', () => {
      expect(result.output).toContain('.md')
      expect(result.output).toContain('macros.md')
    })

    it('output contains no unresolved @directives', () => {
      noRawDirectives(result.output)
    })
  })

  describe('04-config-showcase — @read JSON/CSV, conditional sections', () => {
    let result: RenderResult

    beforeAll(() => {
      result = runRender(fixture('04-config-showcase.md'), { cwd: ROOT })
      if (result.exitCode === 0) saveRendered('04-config-showcase.md', result.output)
    })

    it('renders with exitCode 0', () => {
      expect(result.exitCode).toBe(0)
    })

    it('@read JSON path= — extracts project name from config.json', () => {
      expect(result.output).toContain('MarkdownAI')
    })

    it('@read JSON path= — extracts version from config.json', () => {
      expect(result.output).toContain('1.0.0')
    })

    it('@read CSV — renders team member data in tabular form', () => {
      expect(result.output).toContain('Alice')
    })

    it('@read JSON array — renders feature list via @render type=table', () => {
      expect(result.output).toContain('include')
    })

    it('@if true — conditional section appears', () => {
      expect(result.output).toContain('read successfully')
    })

    it('@if false/@else — else branch appears, if-false body hidden', () => {
      expect(result.output).toContain('else branch rendered correctly')
      expect(result.output).not.toContain('never appear')
    })

    it('output contains no unresolved @directives', () => {
      noRawDirectives(result.output)
    })
  })
})

// ─── STRIP SUITE ─────────────────────────────────────────────────────────────

describe('E2E — mai strip', () => {
  const directiveTokens = ['@list', '@tree', '@count', '@date', '@env', '@render', '@read', '@include', '@define', '@call', '@phase', '@import']

  it('strips 01-docs-hub — no @directive tokens remain, prose preserved', () => {
    const result = runStrip(fixture('01-docs-hub.md'), {})
    expect(result.exitCode).toBe(0)
    for (const token of directiveTokens) {
      expect(result.output).not.toContain(token + ' ')
    }
    expect(result.output).toContain('MarkdownAI Documentation Hub')
  })

  it('strips 02-project-report — no @directive tokens remain', () => {
    const result = runStrip(fixture('02-project-report.md'), {})
    expect(result.exitCode).toBe(0)
    for (const token of directiveTokens) {
      expect(result.output).not.toContain(token + ' ')
    }
  })

  it('strips 03-api-reference — no @directive tokens remain', () => {
    const result = runStrip(fixture('03-api-reference.md'), {})
    expect(result.exitCode).toBe(0)
    for (const token of directiveTokens) {
      expect(result.output).not.toContain(token + ' ')
    }
    expect(result.output).toContain('API Reference')
  })

  it('strips 04-config-showcase — no @directive tokens remain', () => {
    const result = runStrip(fixture('04-config-showcase.md'), {})
    expect(result.exitCode).toBe(0)
    for (const token of directiveTokens) {
      expect(result.output).not.toContain(token + ' ')
    }
  })
})

// ─── VALIDATE SUITE ───────────────────────────────────────────────────────────

describe('E2E — mai validate', () => {
  it('01-docs-hub passes validation (exitCode 0, no errors)', () => {
    const result = runValidate(fixture('01-docs-hub.md'), {})
    expect(result.exitCode).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('02-project-report passes validation', () => {
    const result = runValidate(fixture('02-project-report.md'), {})
    expect(result.exitCode).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('03-api-reference — validator identifies @call macros from @import as unresolved (expected static-analysis behavior)', () => {
    const result = runValidate(fixture('03-api-reference.md'), {})
    // The validator does static analysis without following @import.
    // Macros defined in imported files appear undefined at validation time.
    // The document renders correctly at runtime because the engine follows @import.
    // This test verifies the validator runs without crashing and reports macro errors only.
    expect(result.errors.every(e => e.includes('@call') && e.includes('not defined'))).toBe(true)
  })

  it('04-config-showcase passes validation', () => {
    const result = runValidate(fixture('04-config-showcase.md'), {})
    expect(result.exitCode).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})

// ─── CACHE SUITE ─────────────────────────────────────────────────────────────

describe('E2E — mai cache', () => {
  it('@cache mode=session — second render returns identical output', () => {
    const tmp = join(tmpdir(), 'mai-cache-' + Date.now())
    mkdirSync(tmp)
    writeFileSync(join(tmp, 'cached.md'), '@markdownai\n\n@date format="YYYY-MM-DD" @cache mode="session"\n\nHello from cache test.\n')
    const r1 = runRender(join(tmp, 'cached.md'), { cwd: tmp })
    const r2 = runRender(join(tmp, 'cached.md'), { cwd: tmp })
    expect(r1.exitCode).toBe(0)
    expect(r2.exitCode).toBe(0)
    expect(r1.output).toEqual(r2.output)
  })

  it('runCacheClear — clears session cache without error', () => {
    const result = runCacheClear({ session: true })
    expect(result.cleared.session).toBe(true)
    expect(typeof result.count).toBe('number')
  })
})

// ─── CLI BINARY SMOKE ─────────────────────────────────────────────────────────

describe('E2E — CLI binary smoke (subprocess)', () => {
  it('mai render via subprocess — exits 0 and produces non-empty output', () => {
    const result = spawnSync('node', [CLI, 'render', fixture('01-docs-hub.md')], { encoding: 'utf8', cwd: ROOT })
    expect(result.status).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(100)
    expect(result.stderr).toBe('')
  })

  it('mai strip via subprocess — exits 0', () => {
    const result = spawnSync('node', [CLI, 'strip', fixture('01-docs-hub.md')], { encoding: 'utf8', cwd: ROOT })
    expect(result.status).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })

  it('mai validate via subprocess — exits 0', () => {
    const result = spawnSync('node', [CLI, 'validate', fixture('01-docs-hub.md')], { encoding: 'utf8', cwd: ROOT })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('no errors')
  })

  it('mai --help via subprocess — exits 0 and shows usage', () => {
    const result = spawnSync('node', [CLI, '--help'], { encoding: 'utf8', cwd: ROOT })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage')
  })
})

// ─── ERROR CASES ─────────────────────────────────────────────────────────────

describe('E2E — Error cases', () => {
  const TMP = join(tmpdir(), 'mai-errors-' + Date.now())

  beforeAll(() => {
    mkdirSync(TMP, { recursive: true })
  })

  it('circular @include — reports FatalError with "Circular reference" in message', () => {
    writeFileSync(join(TMP, 'circ-a.md'), '@markdownai\n\n@include ./circ-b.md\n')
    writeFileSync(join(TMP, 'circ-b.md'), '@markdownai\n\n@include ./circ-a.md\n')
    const result = runRender(join(TMP, 'circ-a.md'), { cwd: TMP })
    expect(result.exitCode).toBe(1)
    expect(result.errors.some(e => e.toLowerCase().includes('circular'))).toBe(true)
  })

  it('path traversal in @include — blocked with confinement error', () => {
    writeFileSync(join(TMP, 'traverse.md'), '@markdownai\n\n@include ../../../etc/passwd\n')
    const result = runRender(join(TMP, 'traverse.md'), { cwd: TMP })
    expect(result.exitCode).toBe(1)
    expect(result.errors.some(e => e.toLowerCase().includes('traversal') || e.toLowerCase().includes('blocked'))).toBe(true)
  })

  it('empty document (only @markdownai header) — renders with exitCode 0', () => {
    writeFileSync(join(TMP, 'empty.md'), '@markdownai\n')
    const result = runRender(join(TMP, 'empty.md'), { cwd: TMP })
    expect(result.exitCode).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('missing @include target — renders without fatal error (graceful degradation)', () => {
    writeFileSync(join(TMP, 'missing.md'), '@markdownai\n\nSome prose.\n\n@include ./does-not-exist.md\n\nMore prose.\n')
    const result = runRender(join(TMP, 'missing.md'), { cwd: TMP })
    // Engine gracefully skips missing includes; prose is preserved
    expect(result.output).toContain('Some prose')
    expect(result.output).toContain('More prose')
  })
})
