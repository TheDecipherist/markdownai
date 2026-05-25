import { describe, it, expect } from 'vitest'
import { makeContext, resolveEnv } from '../context.js'
import { runBuiltin, isBuiltin } from '../pipe.js'
import { evalCondition } from '../conditions.js'
import { cacheKey } from '../cache.js'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import type { ParseResult } from '@markdownai/parser'

describe('resolveEnv', () => {
  it('process.env wins over all fallbacks', () => {
    const ctx = makeContext({ env: { FOO: 'from-env' }, envFiles: { FOO: 'from-file' } })
    expect(resolveEnv('FOO', 'from-directive', ctx)).toBe('from-env')
  })

  it('envFile wins over envFallbacks', () => {
    const ctx = makeContext({ env: {}, envFiles: { BAR: 'from-file' }, envFallbacks: { BAR: 'from-fallback' } })
    expect(resolveEnv('BAR', null, ctx)).toBe('from-file')
  })

  it('envFallback wins over directive fallback', () => {
    const ctx = makeContext({ env: {}, envFiles: {}, envFallbacks: { BAZ: 'from-fallback' } })
    expect(resolveEnv('BAZ', 'from-directive', ctx)).toBe('from-fallback')
  })

  it('directive fallback used when nothing else set', () => {
    const ctx = makeContext({ env: {}, envFiles: {}, envFallbacks: {} })
    expect(resolveEnv('MISSING', 'default-value', ctx)).toBe('default-value')
  })

  it('returns empty string when nothing set and no fallback', () => {
    const ctx = makeContext({ env: {}, envFiles: {}, envFallbacks: {} })
    expect(resolveEnv('MISSING', null, ctx)).toBe('')
  })
})

describe('runBuiltin', () => {
  it('grep filters lines matching pattern', () => {
    expect(runBuiltin('grep foo', ['foo.ts', 'bar.js', 'foo.js'])).toEqual(['foo.ts', 'foo.js'])
  })

  it('grep -v filters lines NOT matching pattern', () => {
    expect(runBuiltin('grep -v .ts', ['a.ts', 'b.js', 'c.ts'])).toEqual(['b.js'])
  })

  it('grep -i matches case-insensitively', () => {
    expect(runBuiltin('grep -i FOO', ['foo.ts', 'bar.ts', 'Foo.js'])).toEqual(['foo.ts', 'Foo.js'])
  })

  it('sort sorts alphabetically', () => {
    expect(runBuiltin('sort', ['banana', 'apple', 'cherry'])).toEqual(['apple', 'banana', 'cherry'])
  })

  it('sort -r sorts reverse alphabetically', () => {
    expect(runBuiltin('sort -r', ['banana', 'apple', 'cherry'])).toEqual(['cherry', 'banana', 'apple'])
  })

  it('head -n returns first N lines', () => {
    expect(runBuiltin('head -n 2', ['a', 'b', 'c', 'd'])).toEqual(['a', 'b'])
  })

  it('tail -n returns last N lines', () => {
    expect(runBuiltin('tail -n 2', ['a', 'b', 'c', 'd'])).toEqual(['c', 'd'])
  })

  it('wc -l counts lines', () => {
    expect(runBuiltin('wc -l', ['a', 'b', 'c'])).toEqual(['3'])
  })

  it('uniq removes consecutive duplicates', () => {
    expect(runBuiltin('uniq', ['a', 'a', 'b', 'b', 'a'])).toEqual(['a', 'b', 'a'])
  })

  it('throws on unknown command', () => {
    expect(() => runBuiltin('awk', ['x'])).toThrow(/Unknown built-in command/)
  })
})

describe('isBuiltin', () => {
  it('identifies built-in commands', () => {
    expect(isBuiltin('grep foo')).toBe(true)
    expect(isBuiltin('sort')).toBe(true)
    expect(isBuiltin('head -n 5')).toBe(true)
    expect(isBuiltin('tail -n 3')).toBe(true)
    expect(isBuiltin('wc -l')).toBe(true)
    expect(isBuiltin('uniq')).toBe(true)
  })

  it('returns false for shell-only commands', () => {
    expect(isBuiltin('awk "{print $1}"')).toBe(false)
    expect(isBuiltin('jq ".[]"')).toBe(false)
    expect(isBuiltin('sed "s/foo/bar/"')).toBe(false)
  })
})

describe('evalCondition', () => {
  it('evaluates true literal', () => {
    expect(evalCondition('true', makeContext({ env: {}, envFiles: {}, envFallbacks: {} }))).toBe(true)
  })

  it('evaluates false literal', () => {
    expect(evalCondition('false', makeContext({ env: {}, envFiles: {}, envFallbacks: {} }))).toBe(false)
  })

  it('compares env var string values', () => {
    const ctx = makeContext({ env: { NODE_ENV: 'production' }, envFiles: {}, envFallbacks: {} })
    expect(evalCondition('NODE_ENV === "production"', ctx)).toBe(true)
    expect(evalCondition('NODE_ENV === "development"', ctx)).toBe(false)
  })

  it('returns false on syntax error', () => {
    expect(evalCondition('!!!invalid===', makeContext({ env: {}, envFiles: {}, envFallbacks: {} }))).toBe(false)
  })

  it('evaluates arithmetic comparisons', () => {
    expect(evalCondition('1 + 1 === 2', makeContext({ env: {}, envFiles: {}, envFallbacks: {} }))).toBe(true)
  })
})

describe('cacheKey', () => {
  it('returns same key for same inputs', () => {
    expect(cacheKey('list', { path: './src', depth: '1' })).toBe(cacheKey('list', { path: './src', depth: '1' }))
  })

  it('returns same key regardless of option insertion order', () => {
    const k1 = cacheKey('list', { path: './src', depth: '1' })
    const k2 = cacheKey('list', { depth: '1', path: './src' })
    expect(k1).toBe(k2)
  })

  it('returns different key for different directive types', () => {
    expect(cacheKey('list', { path: './src' })).not.toBe(cacheKey('read', { path: './src' }))
  })

  it('returns different key for different options', () => {
    expect(cacheKey('list', { path: './src' })).not.toBe(cacheKey('list', { path: './dist' }))
  })
})

describe('execute', () => {
  const header = { type: 'header' as const, line: 1, version: null }

  it('returns error for non-MarkdownAI documents', () => {
    const ast: ParseResult = { isMarkdownAI: false, version: null, nodes: [] }
    const result = execute(ast)
    expect(result.output).toBe('')
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('passes through markdown nodes unchanged', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, { type: 'markdown', line: 2, text: '# Hello World', interpolations: [], shellInlines: [] }],
    }
    expect(execute(ast).output).toBe('# Hello World')
  })

  it('resolves @env with fallback when var not set', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, { type: 'env', line: 2, name: 'DEFINITELY_UNSET_VAR_123', fallback: 'my-default' }],
    }
    const result = execute(ast, { ctx: { env: {}, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('my-default')
  })

  it('resolves interpolations in markdown text', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'markdown', line: 2,
          text: 'Hello, {{NAME}}!',
          interpolations: [{ start: 7, end: 15, expression: 'NAME', escaped: false }],
          shellInlines: [],
        },
      ],
    }
    const result = execute(ast, { ctx: { env: { NAME: 'World' }, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('Hello, World!')
  })

  it('registers @define and expands via @call with param substitution', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'define', line: 2, name: 'greet', params: [], local: false,
          body: [{ type: 'markdown', line: 3, text: 'Hello, {{name}}!', interpolations: [], shellInlines: [] }],
          transitions: [],
        },
        { type: 'call', line: 5, name: 'greet', args: { name: 'World' }, positionalArgs: [] },
      ],
    }
    expect(execute(ast).output).toBe('Hello, World!')
  })

  it('walks true branch of @if conditional', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'conditional', line: 2,
          branches: [
            { condition: 'true', body: [{ type: 'markdown', line: 3, text: 'yes', interpolations: [], shellInlines: [] }] },
            { condition: null, body: [{ type: 'markdown', line: 5, text: 'no', interpolations: [], shellInlines: [] }] },
          ],
        },
      ],
    }
    expect(execute(ast).output).toBe('yes')
  })

  it('falls to @else branch when condition is false', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'conditional', line: 2,
          branches: [
            { condition: 'false', body: [{ type: 'markdown', line: 3, text: 'yes', interpolations: [], shellInlines: [] }] },
            { condition: null, body: [{ type: 'markdown', line: 5, text: 'no', interpolations: [], shellInlines: [] }] },
          ],
        },
      ],
    }
    expect(execute(ast).output).toBe('no')
  })

  it('executes pipe with env source, sort transform, and list render', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'pipe', line: 2,
          stages: [
            { type: 'source', node: { type: 'env', line: 2, name: 'PIPE_TEST_DATA', fallback: 'banana\napple\ncherry' } },
            { type: 'builtin', command: 'sort' },
            { type: 'sink', node: { type: 'render', line: 2, args: { type: 'list' } } },
          ],
        },
      ],
    }
    const result = execute(ast, { ctx: { env: {}, envFiles: {}, envFallbacks: {} } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toBe('- apple\n- banana\n- cherry')
  })

  it('skips @phase body when different phase is active', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'phase', line: 2, name: 'setup', transitions: [],
          body: [{ type: 'markdown', line: 3, text: 'setup content', interpolations: [], shellInlines: [] }],
        },
      ],
    }
    const result = execute(ast, { ctx: { phase: 'teardown' } })
    expect(result.output).toBe('')
  })

  it('walks @phase body when phase matches', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [
        header,
        {
          type: 'phase', line: 2, name: 'setup', transitions: [],
          body: [{ type: 'markdown', line: 3, text: 'setup content', interpolations: [], shellInlines: [] }],
        },
      ],
    }
    const result = execute(ast, { ctx: { phase: 'setup' } })
    expect(result.output).toBe('setup content')
  })

  it('passes through @passthrough nodes as-is', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, { type: 'passthrough', line: 2, raw: '@unknown directive args' }],
    }
    expect(execute(ast).output).toBe('@unknown directive args')
  })

})

