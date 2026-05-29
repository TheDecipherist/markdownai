import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@template composition with @foreach', () => {
  let projectDir = ''

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-tplfe-'))
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

  function makeNames(...names: string[]): void {
    mkdirSync(join(projectDir, 'names'), { recursive: true })
    for (const n of names) writeFileSync(join(projectDir, 'names', `${n}.txt`), '')
  }

  describe('per-iteration rendering', () => {
    it('renders the partial once per iteration of the loop', () => {
      makeNames('a', 'b', 'c')
      write('card.md', '@markdownai v1.0\n[card]')
      const r = render(
        '@markdownai v1.0\n@foreach n in @list ./names/ match="*.txt"\n@template ./card.md /\n@foreach-end',
      )
      const matches = r.output.match(/\[card\]/g) ?? []
      expect(matches).toHaveLength(3)
    })

    it('binds the iteration variable to {{ data }} inside the partial', () => {
      makeNames('alice', 'bob')
      write('card.md', '@markdownai v1.0\n<<{{ data }}>>')
      const r = render(
        '@markdownai v1.0\n@foreach name in @list ./names/ match="*.txt"\n@template ./card.md data=name /\n@foreach-end',
      )
      expect(r.output).toContain('<<./names/alice.txt>>')
      expect(r.output).toContain('<<./names/bob.txt>>')
    })

    it('honors as=<name> per iteration', () => {
      makeNames('ada', 'grace')
      write('card.md', '@markdownai v1.0\n[{{ user }}]')
      const r = render(
        '@markdownai v1.0\n@foreach name in @list ./names/ match="*.txt"\n@template ./card.md data=name as=user /\n@foreach-end',
      )
      expect(r.output).toContain('[./names/ada.txt]')
      expect(r.output).toContain('[./names/grace.txt]')
    })

    it('exposes a caller @set value inside every iteration of the partial', () => {
      makeNames('x', 'y')
      write('card.md', '@markdownai v1.0\n{{ siteName }}:{{ data }}')
      const r = render(
        '@markdownai v1.0\n@set siteName = "Acme" /\n@foreach n in @list ./names/ match="*.txt"\n@template ./card.md data=n /\n@foreach-end',
      )
      expect(r.output).toContain('Acme:./names/x.txt')
      expect(r.output).toContain('Acme:./names/y.txt')
    })

    it('iteration N does not see writes from iteration N-1 (sandbox per call)', () => {
      makeNames('first', 'second')
      write('card.md', '@markdownai v1.0\nseen:{{ leaked }}|set:{{ data }}\n@set leaked = data /')
      const r = render(
        '@markdownai v1.0\n@foreach n in @list ./names/ match="*.txt"\n@template ./card.md data=n /\n@foreach-end\nafter:{{ leaked }}end',
      )
      expect(r.output).toContain('seen:|set:./names/first.txt')
      expect(r.output).toContain('seen:|set:./names/second.txt')
      expect(r.output).toContain('after:end')
    })

    it('empty loop source produces no template renders', () => {
      mkdirSync(join(projectDir, 'empty'), { recursive: true })
      write('card.md', '@markdownai v1.0\n[card]')
      const r = render(
        '@markdownai v1.0\n@foreach n in @list ./empty/ match="*.txt"\n@template ./card.md /\n@foreach-end',
      )
      expect(r.output).not.toContain('[card]')
    })
  })

  describe('nested composition', () => {
    it('renders nested @template calls inside per-iteration partials', () => {
      makeNames('a', 'b')
      write('inner.md', '@markdownai v1.0\nINNER({{ data }})')
      write('outer.md', '@markdownai v1.0\nOUTER({{ data }})\n@template ./inner.md data=data /')
      const r = render(
        '@markdownai v1.0\n@foreach n in @list ./names/ match="*.txt"\n@template ./outer.md data=n /\n@foreach-end',
      )
      expect(r.output).toContain('OUTER(./names/a.txt)')
      expect(r.output).toContain('INNER(./names/a.txt)')
      expect(r.output).toContain('OUTER(./names/b.txt)')
      expect(r.output).toContain('INNER(./names/b.txt)')
    })
  })
})
