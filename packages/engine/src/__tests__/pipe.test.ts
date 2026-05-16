import { describe, it, expect } from 'vitest'
import { runBuiltin, isBuiltin } from '../pipe.js'

describe('isBuiltin', () => {
  it('recognizes grep, sort, head, tail, wc, uniq', () => {
    for (const cmd of ['grep', 'sort', 'head', 'tail', 'wc', 'uniq']) {
      expect(isBuiltin(cmd)).toBe(true)
    }
  })

  it('returns false for unknown commands', () => {
    expect(isBuiltin('awk')).toBe(false)
    expect(isBuiltin('jq')).toBe(false)
    expect(isBuiltin('')).toBe(false)
  })

  it('recognizes commands with arguments', () => {
    expect(isBuiltin('head -n 5')).toBe(true)
    expect(isBuiltin('grep -i pattern')).toBe(true)
  })
})

describe('runBuiltin — head', () => {
  const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']

  it('head returns first 10 by default', () => {
    expect(runBuiltin('head', lines)).toEqual(lines.slice(0, 10))
  })

  it('head N returns first N lines', () => {
    expect(runBuiltin('head 3', lines)).toEqual(['a', 'b', 'c'])
  })

  it('head -n N returns first N lines', () => {
    expect(runBuiltin('head -n 3', lines)).toEqual(['a', 'b', 'c'])
  })

  it('head 0 returns empty', () => {
    expect(runBuiltin('head 0', lines)).toEqual([])
  })
})

describe('runBuiltin — tail', () => {
  const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']

  it('tail returns last 10 by default', () => {
    expect(runBuiltin('tail', lines)).toEqual(lines.slice(-10))
  })

  it('tail N returns last N lines', () => {
    expect(runBuiltin('tail 3', lines)).toEqual(['i', 'j', 'k'])
  })

  it('tail -n N returns last N lines', () => {
    expect(runBuiltin('tail -n 3', lines)).toEqual(['i', 'j', 'k'])
  })
})

describe('runBuiltin — sort', () => {
  it('sorts alphabetically', () => {
    expect(runBuiltin('sort', ['banana', 'apple', 'cherry'])).toEqual(['apple', 'banana', 'cherry'])
  })

  it('sort -r reverses', () => {
    expect(runBuiltin('sort -r', ['a', 'b', 'c'])).toEqual(['c', 'b', 'a'])
  })

  it('sort -n sorts numerically', () => {
    expect(runBuiltin('sort -n', ['10', '2', '1'])).toEqual(['1', '2', '10'])
  })

  it('sort -nr sorts numerically reversed', () => {
    expect(runBuiltin('sort -nr', ['10', '2', '1'])).toEqual(['10', '2', '1'])
  })
})

describe('runBuiltin — grep', () => {
  const lines = ['foo bar', 'baz qux', 'FOO baz']

  it('filters matching lines', () => {
    expect(runBuiltin('grep foo', lines)).toEqual(['foo bar'])
  })

  it('grep -i case-insensitive', () => {
    expect(runBuiltin('grep -i foo', lines)).toEqual(['foo bar', 'FOO baz'])
  })

  it('grep -v inverts match', () => {
    expect(runBuiltin('grep -v foo', lines)).toEqual(['baz qux', 'FOO baz'])
  })

  it('grep -iv combines flags', () => {
    expect(runBuiltin('grep -iv foo', lines)).toEqual(['baz qux'])
  })

  it('throws on invalid regex', () => {
    expect(() => runBuiltin('grep [invalid', lines)).toThrow(/invalid pattern/)
  })
})

describe('runBuiltin — wc', () => {
  it('counts lines', () => {
    expect(runBuiltin('wc', ['a', 'b', 'c'])).toEqual(['3'])
  })

  it('wc on empty returns 0', () => {
    expect(runBuiltin('wc', [])).toEqual(['0'])
  })
})

describe('runBuiltin — uniq', () => {
  it('removes consecutive duplicates', () => {
    expect(runBuiltin('uniq', ['a', 'a', 'b', 'b', 'a'])).toEqual(['a', 'b', 'a'])
  })

  it('keeps non-consecutive duplicates', () => {
    expect(runBuiltin('uniq', ['a', 'b', 'a'])).toEqual(['a', 'b', 'a'])
  })
})

describe('runBuiltin — errors', () => {
  it('throws on unknown command', () => {
    expect(() => runBuiltin('awk', [])).toThrow(/Unknown built-in/)
  })
})
