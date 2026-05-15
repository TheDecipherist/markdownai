import { describe, it, expect } from 'vitest'
import { parse } from '../index.js'
import type {
  ASTNode, IncludeNode, ImportNode, EnvNode, DefineNode, CallNode,
  PhaseNode, ConnectNode, ListNode, DbNode, ConditionalNode,
  PipeNode, MarkdownNode, PassthroughNode, RenderNode,
} from '../types.js'

function node<T extends ASTNode>(nodes: ASTNode[], index: number): T {
  const n = nodes[index]
  if (n === undefined) throw new Error(`No node at index ${index} (length ${nodes.length})`)
  return n as T
}

describe('Parser', () => {
  describe('header detection', () => {
    it('returns isMarkdownAI: false when no @markdownai header', () => {
      const result = parse('# Regular markdown\nSome text')
      expect(result.isMarkdownAI).toBe(false)
      expect(result.version).toBeNull()
      expect(result.nodes).toHaveLength(0)
    })

    it('returns isMarkdownAI: true when @markdownai is line 1', () => {
      const result = parse('@markdownai\n# Hello')
      expect(result.isMarkdownAI).toBe(true)
    })

    it('returns version: null when no version pin', () => {
      const result = parse('@markdownai\n# Hello')
      expect(result.version).toBeNull()
    })

    it('extracts version from @markdownai v1.0', () => {
      const result = parse('@markdownai v1.0\n# Hello')
      expect(result.version).toBe('1.0')
    })

    it('includes a header node as nodes[0]', () => {
      const result = parse('@markdownai v1.0\n# Hello')
      expect(result.nodes[0]?.type).toBe('header')
    })
  })

  describe('@include directive', () => {
    it('parses @include with a path', () => {
      const result = parse('@markdownai\n@include ./sections/footer.md')
      const n = node<IncludeNode>(result.nodes, 1)
      expect(n.type).toBe('include')
      expect(n.path).toBe('./sections/footer.md')
      expect(n.condition).toBeNull()
      expect(n.local).toBe(false)
    })

    it('parses @include with condition', () => {
      const result = parse('@markdownai\n@include ./debug.md if env.NODE_ENV == "development"')
      const n = node<IncludeNode>(result.nodes, 1)
      expect(n.condition).toBe('env.NODE_ENV == "development"')
    })

    it('parses @include with @local flag', () => {
      const result = parse('@markdownai\n@include ./local.md @local')
      const n = node<IncludeNode>(result.nodes, 1)
      expect(n.local).toBe(true)
    })

    it('parses line number correctly', () => {
      const result = parse('@markdownai\n@include ./footer.md')
      const n = node<IncludeNode>(result.nodes, 1)
      expect(n.line).toBe(2)
    })
  })

  describe('@import directive', () => {
    it('parses @import with a path', () => {
      const result = parse('@markdownai\n@import ./shared/defaults.md')
      const n = node<ImportNode>(result.nodes, 1)
      expect(n.type).toBe('import')
      expect(n.path).toBe('./shared/defaults.md')
      expect(n.condition).toBeNull()
    })
  })

  describe('@env directive', () => {
    it('parses @env with name and fallback', () => {
      const result = parse('@markdownai\n@env COMPANY_NAME fallback="My Company"')
      const n = node<EnvNode>(result.nodes, 1)
      expect(n.type).toBe('env')
      expect(n.name).toBe('COMPANY_NAME')
      expect(n.fallback).toBe('My Company')
    })

    it('parses @env name-only has null fallback', () => {
      const result = parse('@markdownai\n@env REQUIRED_VAR')
      const n = node<EnvNode>(result.nodes, 1)
      expect(n.name).toBe('REQUIRED_VAR')
      expect(n.fallback).toBeNull()
    })
  })

  describe('@define block directive', () => {
    it('parses @define ... @end block', () => {
      const result = parse('@markdownai\n@define footer\nSome footer content\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.type).toBe('define')
      expect(n.name).toBe('footer')
      expect(n.body.length).toBeGreaterThan(0)
    })

    it('parses @define with @local flag', () => {
      const result = parse('@markdownai\n@define user_row @local\ncontent\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.local).toBe(true)
    })
  })

  describe('@call directive', () => {
    it('parses @call with macro name', () => {
      const result = parse('@markdownai\n@call footer')
      const n = node<CallNode>(result.nodes, 1)
      expect(n.type).toBe('call')
      expect(n.name).toBe('footer')
    })

    it('parses @call with key=value args', () => {
      const result = parse('@markdownai\n@call header title="My Doc"')
      const n = node<CallNode>(result.nodes, 1)
      expect(n.args['title']).toBe('My Doc')
    })
  })

  describe('@phase block directive', () => {
    it('parses @phase ... @end block', () => {
      const result = parse('@markdownai\n@phase build\n## Build phase\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      expect(n.type).toBe('phase')
      expect(n.name).toBe('build')
      expect(n.body.length).toBeGreaterThan(0)
    })

    it('parses @on complete -> @phase transition', () => {
      const result = parse('@markdownai\n@phase build\n## Build\n@on complete -> @phase test\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      expect(n.transitions).toHaveLength(1)
      const t = n.transitions[0]
      expect(t?.event).toBe('complete')
      expect(t?.action.type).toBe('phase')
      if (t?.action.type === 'phase') {
        expect(t.action.name).toBe('test')
      }
    })

    it('throws ParseError for @phase in import context', () => {
      expect(() =>
        parse('@markdownai\n@phase build\ncontent\n@end', { inImport: true })
      ).toThrow()
    })
  })

  describe('@connect directive', () => {
    it('parses @connect directive', () => {
      const result = parse('@markdownai\n@connect primary type="mongodb" uri=env.MONGODB_URI')
      const n = node<ConnectNode>(result.nodes, 1)
      expect(n.type).toBe('connect')
      expect(n.name).toBe('primary')
      expect(n.connectionType).toBe('mongodb')
    })

    it('parses @connect with @local flag', () => {
      const result = parse('@markdownai\n@connect temp type="redis" uri=env.REDIS @local')
      const n = node<ConnectNode>(result.nodes, 1)
      expect(n.local).toBe(true)
    })
  })

  describe('@list directive', () => {
    it('parses @list with path and named args', () => {
      const result = parse('@markdownai\n@list ./src/ match="**/*.ts"')
      const n = node<ListNode>(result.nodes, 1)
      expect(n.type).toBe('list')
      expect(n.path).toBe('./src/')
      expect(n.args['match']).toBe('**/*.ts')
    })
  })

  describe('@db directive', () => {
    it('parses @db directive with query arg', () => {
      const result = parse('@markdownai\n@db query="db.users.find()"')
      const n = node<DbNode>(result.nodes, 1)
      expect(n.type).toBe('db')
      expect(n.args['query']).toBe('db.users.find()')
    })
  })

  describe('@if conditional block', () => {
    it('parses @if ... @endif with one branch', () => {
      const result = parse('@markdownai\n@if env.NODE_ENV == "development"\n> Debug mode\n@endif')
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.type).toBe('conditional')
      expect(n.branches).toHaveLength(1)
      expect(n.branches[0]?.condition).toBe('env.NODE_ENV == "development"')
    })

    it('parses @if ... @else ... @endif with two branches', () => {
      const result = parse('@markdownai\n@if env.ENV == "prod"\nProd\n@else\nDev\n@endif')
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
        '@endif',
      ].join('\n')
      const result = parse(src)
      const n = node<ConditionalNode>(result.nodes, 1)
      expect(n.branches).toHaveLength(3)
    })
  })

  describe('pipe chains', () => {
    it('detects unquoted | and produces pipe node', () => {
      const result = parse('@markdownai\n@list ./src/ match="**/*.ts" | sort | @render type="list"')
      const n = node<PipeNode>(result.nodes, 1)
      expect(n.type).toBe('pipe')
      expect(n.stages.length).toBeGreaterThanOrEqual(3)
      expect(n.stages[0]?.type).toBe('source')
      expect(n.stages[n.stages.length - 1]?.type).toBe('sink')
    })

    it('does not treat | inside quotes as pipe separator', () => {
      const result = parse('@markdownai\n@db query="SELECT a | b FROM t" | @render type="table"')
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
      const result = parse('@markdownai\n@list ./src/ | sort | head -n 5 | @render type="list"')
      const n = node<PipeNode>(result.nodes, 1)
      const sortStage = n.stages[1]
      expect(sortStage?.type).toBe('builtin')
    })

    it('the last @render stage is a sink', () => {
      const result = parse('@markdownai\n@list ./docs/ | @render type="numbered"')
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
  })

  describe('unknown directives', () => {
    it('produces passthrough node for unknown @directive', () => {
      const result = parse('@markdownai\n@unknownDirective some args')
      const n = node<PassthroughNode>(result.nodes, 1)
      expect(n.type).toBe('passthrough')
      expect(n.raw).toBe('@unknownDirective some args')
    })
  })

  describe('parse errors', () => {
    it('throws ParseError for @on outside @phase', () => {
      expect(() =>
        parse('@markdownai\n@on complete -> @phase test')
      ).toThrow()
    })
  })
})
