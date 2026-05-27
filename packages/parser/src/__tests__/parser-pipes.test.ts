import { describe, it, expect } from 'vitest'
import { parse } from '../index.js'
import type {
  ASTNode, ListNode,
  DbNode, PipeNode, MarkdownNode, PassthroughNode, RenderNode, ConditionalNode,
} from '../types.js'

function node<T extends ASTNode>(nodes: ASTNode[], index: number): T {
  const n = nodes[index]
  if (n === undefined) throw new Error(`No node at index ${index} (length ${nodes.length})`)
  return n as T
}

describe('Parser', () => {
  describe('@db directive /', () => {
    it('parses @db directive with query arg', () => {
      const result = parse('@markdownai\n@db query="db.users.find()" /')
      const n = node<DbNode>(result.nodes, 1)
      expect(n.type).toBe('db')
      expect(n.args['query']).toBe('db.users.find()')
    })
  })

  describe('@if conditional block', () => {
    it('parses @if ... @endif with one branch', () => {
      const result = parse('@markdownai\n@if env.NODE_ENV == "development"\n> Debug mode\n@if-end')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.type).toBe('conditional')
      expect(n.branches).toHaveLength(1)
      expect(n.branches[0]?.condition).toBe('env.NODE_ENV == "development"')
    })

    it('parses @if ... @else ... @endif with two branches', () => {
      const result = parse('@markdownai\n@if env.ENV == "prod"\nProd\n@else\nDev\n@if-end')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.branches).toHaveLength(2)
      expect(n.branches[0]?.condition).toBe('env.ENV == "prod"')
      expect(n.branches[1]?.condition).toBeNull()
    })

    it('parses @if ... @elseif ... @else ... @endif with three branches', () => {
      const src = [
        '@markdownai',
        '@if env.TIER == "enterprise"',
        'Enterprise',
        '@elseif env.TIER == "pro"',
        'Pro',
        '@else',
        'Free',
        '@if-end',
      ].join('\n')
      const result = parse(src)
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.branches).toHaveLength(3)
    })
  })

  describe('pipe chains', () => {
    it('detects unquoted | and produces pipe node', () => {
      const result = parse('@markdownai\n@list ./src/ match="**/*.ts" | sort | @render type="list" /')
      const n = node<PipeNode>(result.nodes, 1)
      expect(n.type).toBe('pipe')
      expect(n.stages.length).toBeGreaterThanOrEqual(3)
      expect(n.stages[0]?.type).toBe('source')
      expect(n.stages[n.stages.length - 1]?.type).toBe('sink')
    })

    it('does not treat | inside quotes as pipe separator', () => {
      const result = parse('@markdownai\n@db query="SELECT a | b FROM t" | @render type="table" /')
      const n = node<PipeNode>(result.nodes, 1)
      expect(n.type).toBe('pipe')
      expect(n.stages).toHaveLength(2)
      const src = n.stages[0]
      expect(src?.type).toBe('source')
      if (src?.type === 'source') {
        expect((src.node as DbNode).args['query']).toBe('SELECT a | b FROM t')
      }
    })

    it('classifies builtin commands correctly', () => {
      const result = parse('@markdownai\n@list ./src/ | sort | head -n 5 | @render type="list" /')
      const n = node<PipeNode>(result.nodes, 1)
      const sortStage = n.stages[1]
      expect(sortStage?.type).toBe('builtin')
    })

    it('the last @render stage is a sink', () => {
      const result = parse('@markdownai\n@list ./docs/ | @render type="numbered" /')
      const n = node<PipeNode>(result.nodes, 1)
      const last = n.stages[n.stages.length - 1]
      expect(last?.type).toBe('sink')
      if (last?.type === 'sink') {
        expect((last.node as RenderNode).args['type']).toBe('numbered')
      }
    })
  })

  describe('interpolation', () => {
    it('parses {{ expression }} in markdown text', () => {
      const result = parse('@markdownai\nContact us at {{ env.EMAIL }}')
      const n = node<MarkdownNode>(result.nodes, 1)
      expect(n.type).toBe('markdown')
      expect(n.interpolations).toHaveLength(1)
      expect(n.interpolations[0]?.expression).toBe('env.EMAIL')
      expect(n.interpolations[0]?.escaped).toBe(false)
    })

    it('marks \\{{ as escaped interpolation', () => {
      const result = parse('@markdownai\nUse \\{{ env.NAME }} in config')
      const n = node<MarkdownNode>(result.nodes, 1)
      expect(n.interpolations).toHaveLength(1)
      expect(n.interpolations[0]?.escaped).toBe(true)
    })

    it('parses multiple interpolations in one line', () => {
      const result = parse('@markdownai\n{{ date format="YYYY" }} - {{ env.APP }}')
      const n = node<MarkdownNode>(result.nodes, 1)
      expect(n.interpolations).toHaveLength(2)
    })
  })

  describe('markdown nodes', () => {
    it('produces markdown nodes for regular text', () => {
      const result = parse('@markdownai\n# Hello World')
      const n = node<MarkdownNode>(result.nodes, 1)
      expect(n.type).toBe('markdown')
      expect(n.text).toBe('# Hello World')
      expect(n.interpolations).toHaveLength(0)
    })

    it('fenced code block is immune to interpolation scanning', () => {
      const src = '@markdownai\n```js\nconst x = "{{ env.NAME }}"\n```'
      const result = parse(src)
      const n = node<MarkdownNode>(result.nodes, 1)
      expect(n.interpolations).toHaveLength(0)
    })

    it('inline backtick span is immune to interpolation scanning', () => {
      const result = parse('@markdownai\nUse `{{ env.NAME }}` in config')
      const n = node<MarkdownNode>(result.nodes, 1)
      expect(n.interpolations).toHaveLength(0)
    })
  })

  describe('unknown directives', () => {
    it('produces passthrough node for unknown @directive', () => {
      const result = parse('@markdownai\n@unknownDirective some args /')
      const n = node<PassthroughNode>(result.nodes, 1)
      expect(n.type).toBe('passthrough')
      expect(n.raw).toBe('@unknownDirective some args /')
    })
  })

  describe('as="type" shorthand', () => {
    it('@list with as="list" produces PipeNode with source and sink /', () => {
      const result = parse('@markdownai\n@list ./src/ as="list" /')
      const n = node<PipeNode>(result.nodes, 1)
      expect(n.type).toBe('pipe')
      expect(n.stages[0]?.type).toBe('source')
      const sink = n.stages[n.stages.length - 1]
      expect(sink?.type).toBe('sink')
      if (sink?.type === 'sink') {
        expect((sink.node as RenderNode).args['type']).toBe('list')
      }
    })

    it('as="type" does not appear in the source node args', () => {
      const result = parse('@markdownai\n@list ./src/ as="numbered" /')
      const n = node<PipeNode>(result.nodes, 1)
      const src = n.stages[0]
      if (src?.type === 'source') {
        expect((src.node as ListNode).args['as']).toBeUndefined()
      }
    })
  })

  describe('pipe scalar stage', () => {
    it('pipe without @render sink gets scalar stage appended', () => {
      const result = parse('@markdownai\n@list ./src/ | wc -l /')
      const n = node<PipeNode>(result.nodes, 1)
      const last = n.stages[n.stages.length - 1]
      expect(last?.type).toBe('scalar')
    })
  })

  describe('|| in @if conditions (Wave 2 fix)', () => {
    it('@if A || B parses as conditional, not pipe', () => {
      const result = parse('@markdownai\n@if env.A == "x" || env.B == "y"\ncontent\n@if-end')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.type).toBe('conditional')
      expect(n.branches[0]?.condition).toBe('env.A == "x" || env.B == "y"')
    })

    it('@if A || B || C parses correctly', () => {
      const result = parse('@markdownai\n@if a == 1 || b == 2 || c == 3\nx\n@if-end')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.type).toBe('conditional')
      expect(n.branches[0]?.condition).toMatch(/c == 3/)
    })

    it('@if A && B || C parses correctly', () => {
      const result = parse('@markdownai\n@if a && b || c\nx\n@if-end')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.type).toBe('conditional')
    })

    it('@elseif A || B parses correctly', () => {
      const result = parse('@markdownai\n@if a == 1\nA\n@elseif b == 2 || c == 3\nBC\n@if-end')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.type).toBe('conditional')
      expect(n.branches).toHaveLength(2)
      expect(n.branches[1]?.condition).toBe('b == 2 || c == 3')
    })

    it('|| inside {{ interpolation }} does not break out', () => {
      const result = parse('@markdownai\nValue: {{ env.X || "default" }}')
      // Should parse as a markdown line with interpolation, not a pipe
      expect(result.nodes[1]?.type).toBe('markdown')
    })

    it('| inside single-quoted strings is not a pipe', () => {
      const result = parse(`@markdownai\n@query bash -c 'echo a | wc -l' /`)
      expect(result.nodes[1]?.type).toBe('query')
    })

    it('existing pipe chains still work', () => {
      const result = parse('@markdownai\n@list ./src/ | sort | @render type="list" /')
      const n = node<PipeNode>(result.nodes, 1)
      expect(n.type).toBe('pipe')
      expect(n.stages.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('parse errors', () => {
    it('throws ParseError for @on outside @phase', () => {
      expect(() =>
        parse('@markdownai\n@on-complete @phase test /')
      ).toThrow()
    })

    it('throws ParseError for @include with absolute path', () => {
      expect(() =>
        parse('@markdownai\n@include /etc/passwd /')
      ).toThrow(/absolute/)
    })

    it('produces a render node for standalone @render (engine will detect missing input)', () => {
      // v2: standalone @render parses as a self-closed directive; the engine
      // is responsible for noting that no upstream pipe stage feeds it.
      const result = parse('@markdownai\n@render type="list" /')
      const n = result.nodes.find(node => node.type === 'render')
      expect(n).toBeDefined()
    })
  })
})
