import { describe, it, expect } from 'vitest'
import { parse } from '../index.js'
import type { TemplateNode } from '../types.js'

function templateNodeFrom(source: string): TemplateNode {
  const r = parse(source)
  const node = r.nodes.find(n => n.type === 'template') as TemplateNode | undefined
  if (!node) throw new Error('No @template node found in parse result')
  return node
}

describe('@template parser', () => {
  describe('happy paths', () => {
    it('parses a self-closed @template with a positional path', () => {
      const node = templateNodeFrom('@markdownai\n@template ./report.md /')
      expect(node.path).toBe('./report.md')
      expect(node.dataExpr).toBeNull()
      expect(node.asName).toBe('data')
      expect(node.condition).toBeNull()
      expect(node.cache).toBeNull()
    })

    it('parses @template with path="..." attribute form', () => {
      const node = templateNodeFrom('@markdownai\n@template path="./report.md" /')
      expect(node.path).toBe('./report.md')
    })

    it('parses @template with data=<expression>', () => {
      const node = templateNodeFrom('@markdownai\n@template ./row.md data=user /')
      expect(node.dataExpr).toBe('user')
    })

    it('parses @template with as=<name>', () => {
      const node = templateNodeFrom('@markdownai\n@template ./row.md data=user as=row /')
      expect(node.asName).toBe('row')
      expect(node.dataExpr).toBe('user')
    })

    it('defaults asName to "data" when as= is absent', () => {
      const node = templateNodeFrom('@markdownai\n@template ./row.md data=user /')
      expect(node.asName).toBe('data')
    })

    it('parses inline `if <expression>` after the attrs', () => {
      const node = templateNodeFrom('@markdownai\n@template ./report.md data=row if env.VERBOSE /')
      expect(node.condition).toBe('env.VERBOSE')
    })

    it('parses `if="<expression>"` attribute form', () => {
      const node = templateNodeFrom('@markdownai\n@template ./report.md data=row if="env.VERBOSE" /')
      expect(node.condition).toBe('env.VERBOSE')
    })

    it('preserves source line number on the node', () => {
      const node = templateNodeFrom('@markdownai\n\n\n@template ./report.md /')
      expect(node.line).toBe(4)
    })

    it('allows a path containing whitespace if quoted', () => {
      const node = templateNodeFrom('@markdownai\n@template path="./has space.md" /')
      expect(node.path).toBe('./has space.md')
    })
  })

  describe('parse errors', () => {
    it('throws when path is absolute', () => {
      expect(() => parse('@markdownai\n@template /etc/passwd /'))
        .toThrow(/@template does not allow absolute paths/)
    })

    it('throws when path contains .. traversal', () => {
      expect(() => parse('@markdownai\n@template ../outside.md /'))
        .toThrow(/@template does not allow path traversal/)
    })

    it('throws when no path is provided', () => {
      expect(() => parse('@markdownai\n@template data=row /'))
        .toThrow(/@template requires a path/)
    })

    it('throws when as= is not a valid identifier', () => {
      expect(() => parse('@markdownai\n@template ./r.md data=x as=9bad /'))
        .toThrow(/@template as= must match/)
    })

    it('treats an opener without trailing / as a block opener', () => {
      // Missing ` /` self-close + no @template-end → unclosed-block error.
      expect(() => parse('@markdownai\n@template ./row.md data=row'))
        .toThrow(/Unclosed block.*@template-end/)
    })
  })

  describe('AST node shape', () => {
    it('produces a TemplateNode whose type is "template"', () => {
      const node = templateNodeFrom('@markdownai\n@template ./r.md /')
      expect(node.type).toBe('template')
    })

    it('produces dataExpr === null when data= is absent', () => {
      const node = templateNodeFrom('@markdownai\n@template ./r.md /')
      expect(node.dataExpr).toBeNull()
    })

    it('preserves the raw expression text in dataExpr (no early evaluation)', () => {
      const node = templateNodeFrom('@markdownai\n@template ./r.md data="users.active" /')
      expect(node.dataExpr).toBe('users.active')
    })
  })
})
