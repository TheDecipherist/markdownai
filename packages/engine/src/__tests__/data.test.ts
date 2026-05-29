import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@data engine', () => {
  let projectDir = ''

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-data-'))
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

  describe('assignments', () => {
    it('evaluates a single assignment and stores it under the @data name', () => {
      const r = render(
        '@markdownai v1.0\n@data simple\n  title = "hello"\n@data-end\n{{ simple.title }}',
      )
      expect(r.output).toContain('hello')
    })

    it('evaluates assignments in declaration order, last write wins', () => {
      const r = render(
        '@markdownai v1.0\n@data x\n  a = 1\n  a = 2\n@data-end\n{{ x.a }}',
      )
      expect(r.output).toContain('2')
      expect(r.output).not.toContain('1')
    })

    it('builds a nested object from dot-notation keys', () => {
      const r = render(
        '@markdownai v1.0\n@data r\n  site.name = "Acme"\n  site.theme = "dark"\n@data-end\n{{ r.site.name }}|{{ r.site.theme }}',
      )
      expect(r.output).toContain('Acme|dark')
    })

    it('builds deeply nested objects from multi-segment keys', () => {
      const r = render(
        '@markdownai v1.0\n@data r\n  a.b.c.d = 1\n@data-end\n{{ r.a.b.c.d }}',
      )
      expect(r.output).toContain('1')
    })

    it('resolves a @set value as RHS', () => {
      const r = render(
        '@markdownai v1.0\n@set siteName = "Acme" /\n@data r\n  site = siteName\n@data-end\n{{ r.site }}',
      )
      expect(r.output).toContain('Acme')
    })

    it('stores the composed object so subsequent interpolations resolve nested paths', () => {
      const r = render(
        '@markdownai v1.0\n@data r\n  a = 1\n  b.c = 2\n@data-end\n{{ r.a }} / {{ r.b.c }}',
      )
      expect(r.output).toContain('1 / 2')
    })

    it('redeclaring an existing name overwrites the previous value', () => {
      const r = render(
        '@markdownai v1.0\n@data r\n  a = 1\n@data-end\n@data r\n  b = 2\n@data-end\n{{ r.a }}|{{ r.b }}',
      )
      // After the second @data block, r.a is gone (overwritten by the new object).
      // {{ r.a }} resolves to empty; {{ r.b }} resolves to 2.
      expect(r.output).toContain('|2')
    })
  })

  describe('spread', () => {
    it('merges fields from another object into the result', () => {
      const r = render(
        '@markdownai v1.0\n@data base\n  a = 1\n  b = 2\n@data-end\n@data merged\n  ...base\n  c = 3\n@data-end\n{{ merged.a }}|{{ merged.b }}|{{ merged.c }}',
      )
      expect(r.output).toContain('1|2|3')
    })

    it('later entries override earlier spread fields', () => {
      const r = render(
        '@markdownai v1.0\n@data base\n  theme = "light"\n@data-end\n@data merged\n  ...base\n  theme = "dark"\n@data-end\n{{ merged.theme }}',
      )
      expect(r.output).toContain('dark')
      expect(r.output).not.toContain('light')
    })

    it('processes multiple spreads in declaration order, last wins on collisions', () => {
      const r = render(
        '@markdownai v1.0\n@data a\n  x = 1\n  y = 2\n@data-end\n@data b\n  x = 99\n@data-end\n@data merged\n  ...a\n  ...b\n@data-end\n{{ merged.x }}|{{ merged.y }}',
      )
      expect(r.output).toContain('99|2')
    })

    it('deep-merges spread fields with subsequent dot-notation writes', () => {
      const r = render(
        '@markdownai v1.0\n@data base\n  site.name = "X"\n@data-end\n@data merged\n  ...base\n  site.theme = "dark"\n@data-end\n{{ merged.site.name }}|{{ merged.site.theme }}',
      )
      // Deep merge: site.name from the spread coexists with site.theme from
      // the later assignment.
      expect(r.output).toContain('X|dark')
    })

    it('does not mutate the source object when spreading', () => {
      const r = render(
        '@markdownai v1.0\n@data base\n  site.name = "X"\n@data-end\n@data merged\n  ...base\n  site.theme = "dark"\n@data-end\n{{ base.site.theme }}',
      )
      // After deep-clone-on-spread, mutating merged.site.theme must not leak
      // back to base.site.theme.
      expect(r.output).not.toContain('dark')
    })

    it('WARNs and skips when the spread expression is not an object', () => {
      const r = render(
        '@markdownai v1.0\n@set s = "hello" /\n@data merged\n  ...s\n  a = 1\n@data-end\n{{ merged.a }}',
      )
      expect(r.output).toContain('1')
      expect(r.warnings.some(w => w.includes('did not resolve to an object'))).toBe(true)
    })

    it('WARNs and skips when the spread expression resolves to undefined', () => {
      const r = render(
        '@markdownai v1.0\n@data merged\n  ...neverDefined\n  a = 1\n@data-end\n{{ merged.a }}',
      )
      expect(r.output).toContain('1')
      expect(r.warnings.some(w => w.includes('did not resolve to an object'))).toBe(true)
    })
  })

  describe('composition with @set', () => {
    it('reads from caller @set variables', () => {
      const r = render(
        '@markdownai v1.0\n@set siteName = "Acme" /\n@data r\n  site = siteName\n@data-end\n{{ r.site }}',
      )
      expect(r.output).toContain('Acme')
    })
  })
})
