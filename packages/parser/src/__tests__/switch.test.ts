import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import { ParseError } from '../types.js'
import type { ASTNode, SwitchNode, ForeachNode } from '../types.js'

function node<T extends ASTNode>(nodes: ASTNode[], idx: number): T {
  return nodes[idx] as T
}

describe('Parser — @switch directive', () => {
  describe('basic structure', () => {
    it('parses a basic @switch with two @case branches and a @default', () => {
      const src = [
        '@markdownai',
        '@switch "hello"',
        '  @case "hello"',
        '    Hello body',
        '  @case "world"',
        '    World body',
        '  @default',
        '    Fallback body',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.type).toBe('switch')
      expect(n.expression).toBe('"hello"')
      expect(n.cases).toHaveLength(2)
      expect(n.cases[0]!.caseExpression).toBe('"hello"')
      expect(n.cases[1]!.caseExpression).toBe('"world"')
      expect(n.defaultBody).not.toBeNull()
    })

    it('parses a @switch with a {{ }} expression as its subject', () => {
      const src = [
        '@markdownai',
        "@switch {{ARGUMENTS[0] || 'default'}}",
        '  @case "foo"',
        '    Foo body',
        '  @default',
        '    Fallback',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.type).toBe('switch')
      expect(n.expression).toBe("{{ARGUMENTS[0] || 'default'}}")
      expect(n.cases).toHaveLength(1)
      expect(n.defaultBody).not.toBeNull()
    })

    it('parses a @switch with @case expressions using {{ }}', () => {
      const src = [
        '@markdownai',
        '@switch "production"',
        '  @case {{ENV_STAGE}}',
        '    Stage body',
        '  @default',
        '    Fallback',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.type).toBe('switch')
      expect(n.cases[0]!.caseExpression).toBe('{{ENV_STAGE}}')
    })
  })

  describe('optional clauses', () => {
    it('parses a @switch with only @case branches — defaultBody should be null', () => {
      const src = [
        '@markdownai',
        '@switch "foo"',
        '  @case "foo"',
        '    Foo body',
        '  @case "bar"',
        '    Bar body',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.cases).toHaveLength(2)
      expect(n.defaultBody).toBeNull()
    })

    it('parses a @switch with only @default — cases array should be empty', () => {
      const src = [
        '@markdownai',
        '@switch "anything"',
        '  @default',
        '    Fallback body',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.cases).toHaveLength(0)
      expect(n.defaultBody).not.toBeNull()
    })

    it('parses a @switch with an empty body (no cases, no default)', () => {
      const src = [
        '@markdownai',
        '@switch "value"',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.type).toBe('switch')
      expect(n.cases).toHaveLength(0)
      expect(n.defaultBody).toBeNull()
    })

    it('parses @switch where @default appears before the last @case (valid parse, out-of-order)', () => {
      const src = [
        '@markdownai',
        '@switch "foo"',
        '  @default',
        '    Fallback body',
        '  @case "foo"',
        '    Foo body',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const n = node<SwitchNode>(result.nodes, 1)
      expect(n.cases).toHaveLength(1)
      expect(n.defaultBody).not.toBeNull()
    })
  })

  describe('nesting', () => {
    it('parses a nested @switch inside another @switch', () => {
      const src = [
        '@markdownai',
        '@switch "outer"',
        '  @case "outer"',
        '    @switch "inner"',
        '      @case "inner"',
        '        Inner body',
        '      @default',
        '        Inner fallback',
        '    @endswitch',
        '  @default',
        '    Outer fallback',
        '@endswitch',
      ].join('\n')
      const result = parse(src)
      const outer = node<SwitchNode>(result.nodes, 1)
      expect(outer.type).toBe('switch')
      expect(outer.cases).toHaveLength(1)
      const inner = outer.cases[0]!.body.find(n => n.type === 'switch') as SwitchNode | undefined
      expect(inner).toBeDefined()
      expect(inner!.type).toBe('switch')
      expect(inner!.cases).toHaveLength(1)
    })

    it('parses a @switch inside a @foreach body', () => {
      const src = [
        '@markdownai',
        '@foreach item in items',
        '  @switch {{item}}',
        '    @case "a"',
        '      A body',
        '    @default',
        '      Other',
        '  @endswitch',
        '@end',
      ].join('\n')
      const result = parse(src)
      const fe = node<ForeachNode>(result.nodes, 1)
      expect(fe.type).toBe('foreach')
      const sw = fe.body.find(n => n.type === 'switch') as SwitchNode | undefined
      expect(sw).toBeDefined()
      expect(sw!.expression).toBe('{{item}}')
    })
  })

  describe('error cases', () => {
    it('throws ParseError on unclosed @switch (no @endswitch)', () => {
      const src = [
        '@markdownai',
        '@switch "foo"',
        '  @case "foo"',
        '    Body without closing',
      ].join('\n')
      expect(() => parse(src)).toThrow(ParseError)
    })
  })
})
