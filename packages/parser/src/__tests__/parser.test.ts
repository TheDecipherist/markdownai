import { describe, it, expect } from 'vitest'
import { parse } from '../index.js'
import type {
  ASTNode, IncludeNode, ImportNode, EnvNode, DefineNode, CallNode,
  PhaseNode, ConnectNode, ListNode,
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

    it('returns isMarkdownAI: false when blank line precedes @markdownai', () => {
      const result = parse('\n@markdownai\n# Hello')
      expect(result.isMarkdownAI).toBe(false)
    })

    it('returns isMarkdownAI: false when @markdownai is not on line 1', () => {
      const result = parse('# Header first\n@markdownai')
      expect(result.isMarkdownAI).toBe(false)
    })

    it('version pin with major.minor only — v2.0 extracts correctly', () => {
      const result = parse('@markdownai v2.0\n')
      expect(result.version).toBe('2.0')
    })

    it('returns isMarkdownAI: true when @markdownai follows YAML frontmatter', () => {
      const source = '---\ndescription: test\nscope: project\n---\n@markdownai\n# Hello'
      const result = parse(source)
      expect(result.isMarkdownAI).toBe(true)
    })

    it('returns isMarkdownAI: true when @markdownai follows YAML frontmatter with blank line separator', () => {
      const source = '---\ndescription: test\nscope: project\n---\n\n@markdownai\n# Hello'
      const result = parse(source)
      expect(result.isMarkdownAI).toBe(true)
    })

    it('extracts version when @markdownai v1.0 follows YAML frontmatter', () => {
      const source = '---\ndescription: test\n---\n@markdownai v1.0\n# Hello'
      const result = parse(source)
      expect(result.isMarkdownAI).toBe(true)
      expect(result.version).toBe('1.0')
    })

    it('includes frontmatter lines as markdown nodes before header node', () => {
      const source = '---\ndescription: test\n---\n@markdownai\n# Hello'
      const result = parse(source)
      expect(result.nodes[0]?.type).toBe('markdown')
      const headerIdx = result.nodes.findIndex(n => n.type === 'header')
      expect(headerIdx).toBeGreaterThan(0)
    })

    it('returns isMarkdownAI: false when content after frontmatter is not @markdownai', () => {
      const source = '---\ndescription: test\n---\n# Regular markdown'
      const result = parse(source)
      expect(result.isMarkdownAI).toBe(false)
    })

    it('returns isMarkdownAI: false when frontmatter has no closing ---', () => {
      const source = '---\ndescription: test\n@markdownai\n# Hello'
      const result = parse(source)
      expect(result.isMarkdownAI).toBe(false)
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

    it('parses no params when no parens', () => {
      const result = parse('@markdownai\n@define footer\ncontent\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.params).toEqual([])
    })

    it('parses @define name(param) syntax — single param', () => {
      const result = parse('@markdownai\n@define greet(name)\nHello {{name}}\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.name).toBe('greet')
      expect(n.params).toEqual(['name'])
    })

    it('parses @define name(param1, param2) syntax — multiple params', () => {
      const result = parse('@markdownai\n@define row(title, value)\n{{title}}: {{value}}\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.name).toBe('row')
      expect(n.params).toEqual(['title', 'value'])
    })

    it('parses @define name(param) @local', () => {
      const result = parse('@markdownai\n@define cell(content) @local\n{{content}}\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.name).toBe('cell')
      expect(n.params).toEqual(['content'])
      expect(n.local).toBe(true)
    })

    it('collects @on complete -> next at @define top level into transitions', () => {
      const result = parse('@markdownai\n@define probe @local\n@on complete -> next\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.type).toBe('define')
      expect(n.transitions).toHaveLength(1)
      expect(n.transitions[0]?.action.type).toBe('next')
    })

    it('allows @on complete -> next nested inside @if within @define (placed in conditional body)', () => {
      const result = parse('@markdownai\n@define probe @local\n@if {{ disabled }}\n@on complete -> next\n@endif\nbody\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.type).toBe('define')
      // The nested @on lives in the conditional branch body, not on the define's transitions
      expect(n.transitions).toEqual([])
      const conditional = n.body.find(b => b.type === 'conditional')
      expect(conditional).toBeDefined()
    })

    it('collects @on complete -> halt at @define top level', () => {
      const result = parse('@markdownai\n@define fatal\n@on complete -> halt\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.transitions).toHaveLength(1)
      expect(n.transitions[0]?.action.type).toBe('halt')
    })

    it('initializes empty transitions array when @define has no @on', () => {
      const result = parse('@markdownai\n@define plain\ncontent\n@end')
      const n = node<DefineNode>(result.nodes, 1)
      expect(n.transitions).toEqual([])
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

    it('parses @call name(arg1, arg2) positional paren syntax', () => {
      const result = parse('@markdownai\n@call greet(Alice, Admin)')
      const n = node<CallNode>(result.nodes, 1)
      expect(n.name).toBe('greet')
      expect(n.positionalArgs).toEqual(['Alice', 'Admin'])
      expect(n.args).toEqual({})
    })

    it('parses @call name(key=value) named paren syntax', () => {
      const result = parse('@markdownai\n@call row(title=Hello, value=World)')
      const n = node<CallNode>(result.nodes, 1)
      expect(n.name).toBe('row')
      expect(n.args['title']).toBe('Hello')
      expect(n.args['value']).toBe('World')
      expect(n.positionalArgs).toEqual([])
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

    it('parses @on complete -> bare-phase-name transition (no @phase prefix)', () => {
      const result = parse('@markdownai\n@phase build\n@on complete -> next_phase\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      expect(n.transitions).toHaveLength(1)
      const t = n.transitions[0]
      expect(t?.action.type).toBe('phase')
      if (t?.action.type === 'phase') {
        expect(t.action.name).toBe('next_phase')
      }
    })

    it('handles snake_case + dot-suffix phase names in bare transitions', () => {
      const result = parse('@markdownai\n@phase first\n@on complete -> 7c_complete\n@end\n@phase 7c_complete\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      expect(n.transitions[0]?.action.type).toBe('phase')
      if (n.transitions[0]?.action.type === 'phase') {
        expect(n.transitions[0].action.name).toBe('7c_complete')
      }
    })

    it('collects @on complete -> halt at @phase top level into transitions', () => {
      const result = parse('@markdownai\n@phase guard\n@on complete -> halt\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      expect(n.transitions).toHaveLength(1)
      expect(n.transitions[0]?.action.type).toBe('halt')
    })

    it('allows @on complete -> halt nested inside @if within @phase (placed in conditional body)', () => {
      const result = parse('@markdownai\n@phase guard\n@if {{ refuse }}\n@on complete -> halt\n@endif\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      // The nested @on lives in the conditional branch body, not on the phase's transitions
      expect(n.transitions).toEqual([])
      const conditional = n.body.find(b => b.type === 'conditional')
      expect(conditional).toBeDefined()
    })

    it('collects @on complete -> next at @phase top level', () => {
      const result = parse('@markdownai\n@phase step\n@on complete -> next\n@end')
      const n = node<PhaseNode>(result.nodes, 1)
      expect(n.transitions[0]?.action.type).toBe('next')
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

})
