import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@template engine', () => {
  let projectDir = ''

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-tpl-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function write(name: string, content: string): string {
    const p = join(projectDir, name)
    writeFileSync(p, content, 'utf8')
    return p
  }

  function render(content: string) {
    const filePath = write('main.md', content)
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null },
      },
    })
  }

  describe('basic rendering', () => {
    it('inlines the rendered partial at the call site', () => {
      write('card.md', '@markdownai v1.0\ncard-content')
      const r = render('@markdownai v1.0\n@template ./card.md /')
      expect(r.output).toContain('card-content')
    })

    it('binds data= expression to {{ data.* }} inside the partial', () => {
      write('row.md', '@markdownai v1.0\n{{ data.name }}-{{ data.role }}')
      const r = render(
        '@markdownai v1.0\n@data u\n  name = "Ada"\n  role = "eng"\n@data-end\n@template ./row.md data=u /',
      )
      expect(r.output).toContain('Ada-eng')
    })

    it('exposes the binding under as=<name> instead of "data"', () => {
      write('row.md', '@markdownai v1.0\n{{ row.name }}')
      const r = render(
        '@markdownai v1.0\n@data u\n  name = "Ada"\n@data-end\n@template ./row.md data=u as=row /',
      )
      expect(r.output).toContain('Ada')
    })

    it('renders empty for {{ data }} when data= is omitted', () => {
      write('row.md', '@markdownai v1.0\nstart{{ data.name }}end')
      const r = render('@markdownai v1.0\n@template ./row.md /')
      expect(r.output).toContain('startend')
    })

    it('returns empty render with a WARN when the partial has no @markdownai header', () => {
      write('plain.md', '# Not a MarkdownAI document')
      const r = render('@markdownai v1.0\nbefore\n@template ./plain.md /\nafter')
      expect(r.output).toContain('before')
      expect(r.output).toContain('after')
      expect(r.output).not.toContain('Not a MarkdownAI')
      expect(r.warnings.some(w => w.includes('no @markdownai header'))).toBe(true)
    })

    it('returns empty render with a WARN when the partial file does not exist', () => {
      const r = render('@markdownai v1.0\nbefore\n@template ./missing.md /\nafter')
      expect(r.output).toContain('before')
      expect(r.output).toContain('after')
      expect(r.warnings.some(w => w.includes('cannot read file'))).toBe(true)
    })

    it('renders nothing when condition is false', () => {
      write('row.md', '@markdownai v1.0\nROW')
      const r = render('@markdownai v1.0\n@template ./row.md if false /')
      expect(r.output).not.toContain('ROW')
    })

    it('renders when condition is true', () => {
      write('row.md', '@markdownai v1.0\nROW')
      const r = render('@markdownai v1.0\n@template ./row.md if true /')
      expect(r.output).toContain('ROW')
    })
  })

  describe('scope inheritance (reads)', () => {
    it('reads caller @set values from inside the partial', () => {
      write('row.md', '@markdownai v1.0\nhello {{ siteName }}')
      const r = render(
        '@markdownai v1.0\n@set siteName = "Acme" /\n@template ./row.md /',
      )
      expect(r.output).toContain('hello Acme')
    })
  })

  describe('scope sandbox (writes)', () => {
    it('does not leak @set from inside the partial back to the caller', () => {
      write('row.md', '@markdownai v1.0\n@set leaked = "x" /\ninside')
      const r = render(
        '@markdownai v1.0\n@template ./row.md /\nafter:{{ leaked }}end',
      )
      expect(r.output).toContain('after:end')
    })

    it('does not leak @data from inside the partial back to the caller', () => {
      write('row.md', '@markdownai v1.0\n@data inner\n  flag = 1\n@data-end\n{{ inner.flag }}')
      const r = render(
        '@markdownai v1.0\n@template ./row.md /\nafter:{{ inner.flag }}end',
      )
      expect(r.output).toContain('after:end')
    })

    it('does not pollute caller scope when the partial succeeds', () => {
      write('row.md', '@markdownai v1.0\n@set leaked = "x" /\nbody')
      const r = render(
        '@markdownai v1.0\n@set keep = "ok" /\nbefore:{{ keep }}|{{ leaked }}\n@template ./row.md /\nafter:{{ keep }}|{{ leaked }}',
      )
      expect(r.output).toContain('before:ok|')
      expect(r.output).toContain('after:ok|')
    })
  })

  describe('binding precedence', () => {
    it('partial sees the bound value, not a caller variable of the same name', () => {
      write('row.md', '@markdownai v1.0\n{{ data.tag }}')
      const r = render(
        '@markdownai v1.0\n@set data = "outer" /\n@data inner\n  tag = "inside"\n@data-end\n@template ./row.md data=inner /',
      )
      expect(r.output).toContain('inside')
      expect(r.output).not.toContain('outer')
    })

    it('restores the caller variable after the partial render returns', () => {
      write('row.md', '@markdownai v1.0\nbody')
      const r = render(
        '@markdownai v1.0\n@set data = "outer" /\n@data inner\n  tag = "x"\n@data-end\nbefore:{{ data }}\n@template ./row.md data=inner /\nafter:{{ data }}',
      )
      expect(r.output).toContain('before:outer')
      expect(r.output).toContain('after:outer')
    })
  })

  describe('composition with @data', () => {
    it('renders a partial against a composed @data object', () => {
      write('report.md', '@markdownai v1.0\nname={{ data.site.name }} theme={{ data.site.theme }}')
      const r = render(
        '@markdownai v1.0\n@data myReport\n  site.name = "Acme"\n  site.theme = "dark"\n@data-end\n@template ./report.md data=myReport /',
      )
      expect(r.output).toContain('name=Acme')
      expect(r.output).toContain('theme=dark')
    })

    it('reuses the same @data composite across multiple template calls', () => {
      write('a.md', '@markdownai v1.0\nA:{{ data.x }}')
      write('b.md', '@markdownai v1.0\nB:{{ data.x }}')
      const r = render(
        '@markdownai v1.0\n@data shared\n  x = "v"\n@data-end\n@template ./a.md data=shared /\n@template ./b.md data=shared /',
      )
      expect(r.output).toContain('A:v')
      expect(r.output).toContain('B:v')
    })
  })
})
