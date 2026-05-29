import { describe, it, expect } from 'vitest'
import { parse } from '../index.js'
import type { DataNode, DataAssignEntry, DataSpreadEntry } from '../types.js'

function dataNodeFrom(source: string): DataNode {
  const r = parse(source)
  const node = r.nodes.find(n => n.type === 'data') as DataNode | undefined
  if (!node) throw new Error('No @data node found in parse result')
  return node
}

describe('@data parser', () => {
  describe('happy paths', () => {
    it('parses a single assignment line', () => {
      const node = dataNodeFrom('@markdownai\n@data simple\n  title = "hello"\n@data-end')
      expect(node.name).toBe('simple')
      expect(node.entries).toHaveLength(1)
      const e = node.entries[0] as DataAssignEntry
      expect(e.kind).toBe('assign')
      expect(e.key).toEqual(['title'])
      expect(e.rhs).toBe('"hello"')
    })

    it('parses multiple assignment lines in declaration order', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data x\n  a = 1\n  b = 2\n  c = 3\n@data-end',
      )
      expect(node.entries.map(e => (e as DataAssignEntry).key[0])).toEqual(['a', 'b', 'c'])
    })

    it('parses dot-notation keys into split path arrays', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  site.name = "Acme"\n  site.theme = "dark"\n@data-end',
      )
      const e0 = node.entries[0] as DataAssignEntry
      const e1 = node.entries[1] as DataAssignEntry
      expect(e0.key).toEqual(['site', 'name'])
      expect(e1.key).toEqual(['site', 'theme'])
    })

    it('parses a deeply nested dot-notation key', () => {
      const node = dataNodeFrom('@markdownai\n@data r\n  a.b.c.d = 1\n@data-end')
      const e = node.entries[0] as DataAssignEntry
      expect(e.key).toEqual(['a', 'b', 'c', 'd'])
    })

    it('parses spread lines into DataSpreadEntry nodes', () => {
      const node = dataNodeFrom('@markdownai\n@data r\n  ...other\n@data-end')
      const e = node.entries[0] as DataSpreadEntry
      expect(e.kind).toBe('spread')
      expect(e.rhs).toBe('other')
    })

    it('parses mixed spreads and assignments in declaration order', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  ...baseConfig\n  site.theme = "dark"\n@data-end',
      )
      expect(node.entries[0]?.kind).toBe('spread')
      expect(node.entries[1]?.kind).toBe('assign')
    })

    it('parses multiple spread lines', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  ...a\n  ...b\n@data-end',
      )
      expect(node.entries).toHaveLength(2)
      expect((node.entries[0] as DataSpreadEntry).rhs).toBe('a')
      expect((node.entries[1] as DataSpreadEntry).rhs).toBe('b')
    })

    it('ignores blank body lines', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  a = 1\n\n  b = 2\n@data-end',
      )
      expect(node.entries).toHaveLength(2)
    })

    it('ignores comment lines beginning with #', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  # this is a comment\n  a = 1\n@data-end',
      )
      expect(node.entries).toHaveLength(1)
      expect((node.entries[0] as DataAssignEntry).key).toEqual(['a'])
    })

    it('records the source line on each entry for error reporting', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  a = 1\n  b = 2\n@data-end',
      )
      const first = node.entries[0]!
      const second = node.entries[1]!
      expect(second.line).toBe(first.line + 1)
    })

    it('accepts directive references and interpolations as RHS', () => {
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  users = @db using=mainDb find="users"\n  ver = {{ pkg.version }}\n@data-end',
      )
      const a = node.entries[0] as DataAssignEntry
      const b = node.entries[1] as DataAssignEntry
      expect(a.rhs).toBe('@db using=mainDb find="users"')
      expect(b.rhs).toBe('{{ pkg.version }}')
    })

    it('stores the original block opener line for diagnostics', () => {
      const node = dataNodeFrom('@markdownai\n\n@data r\n  a = 1\n@data-end')
      expect(node.line).toBe(3)
    })
  })

  describe('parse errors', () => {
    it('throws when the opener has no name', () => {
      expect(() => parse('@markdownai\n@data\n  a = 1\n@data-end'))
        .toThrow(/@data requires a variable name/)
    })

    it('throws when the opener name is not an identifier', () => {
      expect(() => parse('@markdownai\n@data 9bad\n  a = 1\n@data-end'))
        .toThrow(/@data name must match/)
    })

    it('throws when a body line has no = and does not start with ...', () => {
      expect(() => parse('@markdownai\n@data r\n  bare-line\n@data-end'))
        .toThrow(/@data body lines must be/)
    })

    it('throws unclosed-block error when @data-end is missing', () => {
      expect(() => parse('@markdownai\n@data r\n  a = 1\n'))
        .toThrow(/Unclosed block.*@data-end/)
    })

    it('rejects v1 @end inside a @data block with the canonical diagnostic', () => {
      expect(() => parse('@markdownai\n@data r\n  a = 1\n@end'))
        .toThrow(/v1 close tag.*@end.*use "@data-end" instead/)
    })
  })

  describe('AST node shape', () => {
    it('produces a DataNode whose type is "data"', () => {
      const node = dataNodeFrom('@markdownai\n@data r\n  a = 1\n@data-end')
      expect(node.type).toBe('data')
    })

    it('produces DataAssignEntry entries with kind:"assign"', () => {
      const node = dataNodeFrom('@markdownai\n@data r\n  a = 1\n@data-end')
      expect(node.entries[0]?.kind).toBe('assign')
    })

    it('produces DataSpreadEntry entries with kind:"spread"', () => {
      const node = dataNodeFrom('@markdownai\n@data r\n  ...other\n@data-end')
      expect(node.entries[0]?.kind).toBe('spread')
    })

    it('registers @data as a PARAM_BODY_DIRECTIVE in the parser', () => {
      // Body lines must be collected verbatim as DataEntry records, not
      // recursively re-parsed into child AST nodes. A directive-shaped RHS
      // should land as a raw string on a DataAssignEntry.
      const node = dataNodeFrom(
        '@markdownai\n@data r\n  flag = @if true\n@data-end',
      )
      expect(node.entries).toHaveLength(1)
      const e = node.entries[0] as DataAssignEntry
      expect(e.key).toEqual(['flag'])
      expect(e.rhs).toBe('@if true')
    })
  })
})
