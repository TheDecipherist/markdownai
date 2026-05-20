import { describe, it, expect, beforeAll } from 'vitest'
import { resolve, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { RenderResult } from '@markdownai/core'
import { runRender } from '@markdownai/core'

const ROOT = resolve(import.meta.dirname, '..')
const MAI = join(ROOT, 'mai')
const RENDERED = join(ROOT, 'e2e/rendered')

mkdirSync(RENDERED, { recursive: true })

function saveRendered(name: string, output: string): void {
  writeFileSync(join(RENDERED, name), output, 'utf8')
}

function fixture(name: string): string {
  return join(MAI, name)
}

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
