import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('file.containsLine / file.containsSection (@if helpers)', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-fch-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function render(content: string) {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null },
      },
    })
  }

  describe('file.containsLine', () => {
    it('returns true when the regex matches a line', () => {
      writeFileSync(join(projectDir, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n\n- foo\n', 'utf8')
      const result = render(
        `@markdownai v1.0
@if file.containsLine("CHANGELOG.md", "^## Unreleased")
  has unreleased
@endif
`,
      )
      expect(result.output).toContain('has unreleased')
    })

    it('returns false when the regex does not match', () => {
      writeFileSync(join(projectDir, 'CHANGELOG.md'), '# Changelog\n\n## 1.0.0\n\n- foo\n', 'utf8')
      const result = render(
        `@markdownai v1.0
@if file.containsLine("CHANGELOG.md", "^## Unreleased")
  has unreleased
@else
  no unreleased
@endif
`,
      )
      expect(result.output).toContain('no unreleased')
    })

    it('returns false when file does not exist', () => {
      const result = render(
        `@markdownai v1.0
@if file.containsLine("missing.md", "anything")
  found
@else
  not found
@endif
`,
      )
      expect(result.output).toContain('not found')
    })
  })

  describe('file.containsSection', () => {
    it('returns true when section heading is present (with #s in pattern)', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '# Title\n\n## Bugs\n\n- bug 1\n', 'utf8')
      const result = render(
        `@markdownai v1.0
@if file.containsSection("doc.md", "## Bugs")
  has bugs
@endif
`,
      )
      expect(result.output).toContain('has bugs')
    })

    it('matches any heading level when pattern has no leading #', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '# Title\n\n### Bugs\n\nText.\n', 'utf8')
      const result = render(
        `@markdownai v1.0
@if file.containsSection("doc.md", "Bugs")
  has bugs section at some level
@endif
`,
      )
      expect(result.output).toContain('has bugs section at some level')
    })

    it('returns false when section is absent', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '# Title\n\n## Features\n\n- f1\n', 'utf8')
      const result = render(
        `@markdownai v1.0
@if file.containsSection("doc.md", "## Bugs")
  has bugs
@else
  no bugs
@endif
`,
      )
      expect(result.output).toContain('no bugs')
    })

    it('does NOT match a heading-shaped string embedded mid-line', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '# Title\n\nNot a heading: ## Bugs in prose\n', 'utf8')
      const result = render(
        `@markdownai v1.0
@if file.containsSection("doc.md", "## Bugs")
  has bugs
@else
  no bugs
@endif
`,
      )
      expect(result.output).toContain('no bugs')
    })
  })
})
