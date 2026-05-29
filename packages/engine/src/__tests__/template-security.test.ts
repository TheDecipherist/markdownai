import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'
import { ParseError } from '@markdownai/parser'

describe('@template security', () => {
  let projectDir = ''

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-tplsec-'))
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

  describe('path confinement (parse-time)', () => {
    it('rejects absolute paths at parse time', () => {
      expect(() => parse('@markdownai v1.0\n@template /etc/passwd /'))
        .toThrow(ParseError)
    })

    it('rejects .. traversal at parse time', () => {
      expect(() => parse('@markdownai v1.0\n@template ../../outside.md /'))
        .toThrow(ParseError)
    })
  })

  describe('circular reference detection', () => {
    it('captures a circular-reference fatal when a partial references itself', () => {
      write('a.md', '@markdownai v1.0\n@template ./a.md /')
      const r = render('@markdownai v1.0\n@template ./a.md /')
      expect(r.errors.some(e => e.includes('Circular reference'))).toBe(true)
    })

    it('captures a circular-reference fatal when a chain creates a cycle', () => {
      write('a.md', '@markdownai v1.0\n@template ./b.md /')
      write('b.md', '@markdownai v1.0\n@template ./a.md /')
      const r = render('@markdownai v1.0\n@template ./a.md /')
      expect(r.errors.some(e => e.includes('Circular reference'))).toBe(true)
    })
  })

  describe('diamond inclusion', () => {
    it('renders the same partial twice when called from two independent sites', () => {
      write('shared.md', '@markdownai v1.0\n[{{ data }}]')
      const r = render(
        '@markdownai v1.0\n@set a = "first" /\n@set b = "second" /\n@template ./shared.md data=a /\n@template ./shared.md data=b /',
      )
      expect(r.output).toContain('[first]')
      expect(r.output).toContain('[second]')
    })
  })
})
