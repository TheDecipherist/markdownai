import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { ASTNode, ReadNode, QueryNode, HttpNode, DateNode, GraphNode, TreeNode, CountNode, HeaderNode } from '../types.js'

function node<T extends ASTNode>(nodes: ASTNode[], idx: number): T {
  return nodes[idx] as T
}

describe('Parser — missing directive coverage', () => {
  describe('@read directive', () => {
    it('parses @read with path', () => {
      const result = parse('@markdownai\n@read ./docs/file.txt')
      expect(result.nodes).toHaveLength(2)
      const n = node<ReadNode>(result.nodes, 1)
      expect(n.type).toBe('read')
      expect(n.path).toBe('./docs/file.txt')
    })

    it('parses @read with named args', () => {
      const result = parse('@markdownai\n@read ./data.csv lines=10')
      const n = node<ReadNode>(result.nodes, 1)
      expect(n.type).toBe('read')
      expect(n.args['lines']).toBe('10')
    })
  })

  describe('@query directive', () => {
    it('parses @query with command', () => {
      const result = parse('@markdownai\n@query "SELECT * FROM users"')
      const n = node<QueryNode>(result.nodes, 1)
      expect(n.type).toBe('query')
      expect(n.command).toBe('SELECT * FROM users')
    })

    it('parses @query with named args', () => {
      const result = parse('@markdownai\n@query "SELECT id FROM t" limit=5')
      const n = node<QueryNode>(result.nodes, 1)
      expect(n.args['limit']).toBe('5')
    })
  })

  describe('@http directive', () => {
    it('parses @http with url arg', () => {
      const result = parse('@markdownai\n@http url=https://api.example.com/data')
      const n = node<HttpNode>(result.nodes, 1)
      expect(n.type).toBe('http')
      expect(n.args['url']).toBe('https://api.example.com/data')
    })

    it('parses @http with method arg', () => {
      const result = parse('@markdownai\n@http url=https://api.example.com method=GET')
      const n = node<HttpNode>(result.nodes, 1)
      expect(n.args['method']).toBe('GET')
    })
  })

  describe('@date directive', () => {
    it('parses @date with no args', () => {
      const result = parse('@markdownai\n@date')
      const n = node<DateNode>(result.nodes, 1)
      expect(n.type).toBe('date')
    })

    it('parses @date with format arg', () => {
      const result = parse('@markdownai\n@date format="YYYY-MM-DD"')
      const n = node<DateNode>(result.nodes, 1)
      expect(n.args['format']).toBe('YYYY-MM-DD')
    })
  })

  describe('@graph directive', () => {
    it('parses graph fenced block', () => {
      const result = parse('@markdownai\n```mai-graph\nA --> B\nB --> C\n```')
      const n = node<GraphNode>(result.nodes, 1)
      expect(n.type).toBe('graph')
      expect(n.raw).toContain('A --> B')
    })
  })

  describe('@tree directive', () => {
    it('parses @tree with path', () => {
      const result = parse('@markdownai\n@tree ./src')
      const n = node<TreeNode>(result.nodes, 1)
      expect(n.type).toBe('tree')
      expect(n.path).toBe('./src')
    })

    it('parses @tree with depth arg', () => {
      const result = parse('@markdownai\n@tree ./src depth=2')
      const n = node<TreeNode>(result.nodes, 1)
      expect(n.args['depth']).toBe('2')
    })
  })

  describe('@count directive', () => {
    it('parses @count with path', () => {
      const result = parse('@markdownai\n@count ./src')
      const n = node<CountNode>(result.nodes, 1)
      expect(n.type).toBe('count')
      expect(n.path).toBe('./src')
    })

    it('parses @count with pattern arg', () => {
      const result = parse('@markdownai\n@count ./src pattern=*.ts')
      const n = node<CountNode>(result.nodes, 1)
      expect(n.args['pattern']).toBe('*.ts')
    })
  })

  describe('@header detection', () => {
    it('header node has correct type', () => {
      const result = parse('@markdownai\n# Title')
      const n = node<HeaderNode>(result.nodes, 0)
      expect(n.type).toBe('header')
    })

    it('header node version is null when unpinned', () => {
      const result = parse('@markdownai\n# Title')
      const n = node<HeaderNode>(result.nodes, 0)
      expect(n.version).toBeNull()
    })

    it('header node version extracted from @markdownai v1.0', () => {
      const result = parse('@markdownai v1.0\n# Title')
      const n = node<HeaderNode>(result.nodes, 0)
      expect(n.version).toBe('1.0')
    })
  })
})

describe('Parser — error cases', () => {
  it('throws ParseError for @call with no name', () => {
    expect(() => parse('@markdownai\n@call')).toThrow(/macro name/)
  })

  it('throws ParseError for @connect with no name', () => {
    expect(() => parse('@markdownai\n@connect')).toThrow(/name/)
  })

  it('throws ParseError for @connect with no type=', () => {
    expect(() => parse('@markdownai\n@connect mydb')).toThrow(/type=/)
  })

  it('throws ParseError for @env with no name', () => {
    expect(() => parse('@markdownai\n@env')).toThrow(/variable name/)
  })

  it('throws ParseError for @phase with no name', () => {
    expect(() => parse('@markdownai\n@phase\nBody\n@end')).toThrow(/name/)
  })

  it('produces passthrough for unclosed backtick fence', () => {
    const result = parse('@markdownai\n```js\nconst x = 1')
    expect(result.nodes.length).toBeGreaterThan(1)
  })

  it('parses tilde fence content as markdown nodes without error', () => {
    const result = parse('@markdownai\n~~~python\nprint("hello")\n~~~')
    expect(result.isMarkdownAI).toBe(true)
    expect(result.nodes.length).toBeGreaterThan(0)
  })
})

