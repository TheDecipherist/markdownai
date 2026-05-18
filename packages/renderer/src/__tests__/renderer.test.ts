import { describe, it, expect } from 'vitest'
import { render } from '../index.js'

describe('Renderer', () => {
  describe('list format', () => {
    it('renders data as unordered markdown list', () => {
      const out = render({ type: 'list', data: ['alpha', 'beta', 'gamma'] })
      expect(out).toBe('- alpha\n- beta\n- gamma')
    })

    it('produces one bullet per item', () => {
      const out = render({ type: 'list', data: ['only'] })
      expect(out).toBe('- only')
    })
  })

  describe('numbered format', () => {
    it('renders data as ordered markdown list', () => {
      const out = render({ type: 'numbered', data: ['first', 'second', 'third'] })
      expect(out).toBe('1. first\n2. second\n3. third')
    })
  })

  describe('links format', () => {
    it('renders file paths as markdown links', () => {
      const out = render({ type: 'links', data: ['./docs/intro.md', './docs/guide.md'] })
      expect(out).toContain('[intro](./docs/intro.md)')
      expect(out).toContain('[guide](./docs/guide.md)')
    })

    it('strips extension from link text', () => {
      const out = render({ type: 'links', data: ['./foo/bar.md'] })
      expect(out).toContain('[bar]')
    })
  })

  describe('table format', () => {
    it('renders tab-separated rows as GFM pipe table with explicit columns', () => {
      const out = render({
        type: 'table',
        data: ['alice\t30', 'bob\t25'],
        columns: ['Name', 'Age'],
      })
      expect(out).toContain('| Name')
      expect(out).toContain('| Age')
      expect(out).toContain('| alice')
      expect(out).toContain('| bob')
      // Separator row
      expect(out).toContain('|---')
    })

    it('uses first row as headers when no columns provided', () => {
      const out = render({ type: 'table', data: ['Name\tAge', 'carol\t28'] })
      expect(out).toContain('| Name')
      expect(out).toContain('| carol')
    })
  })

  describe('code format', () => {
    it('wraps data in fenced code block', () => {
      const out = render({ type: 'code', data: ['const x = 1', 'const y = 2'] })
      expect(out).toMatch(/^```/)
      expect(out).toMatch(/```$/)
      expect(out).toContain('const x = 1')
    })

    it('includes language when options.lang is set', () => {
      const out = render({ type: 'code', data: ['x = 1'], options: { lang: 'python' } })
      expect(out).toMatch(/^```python/)
    })
  })

  describe('inline format', () => {
    it('returns data joined by space', () => {
      const out = render({ type: 'inline', data: ['hello', 'world'] })
      expect(out).toBe('hello world')
    })

    it('returns scalar value for single item', () => {
      const out = render({ type: 'inline', data: ['42'] })
      expect(out).toBe('42')
    })
  })

  describe('bar format', () => {
    it('renders ASCII bar chart with █ characters', () => {
      const out = render({ type: 'bar', data: ['auth_failure 847', 'timeout 534'] })
      expect(out).toContain('█')
      expect(out).toContain('auth_failure')
      expect(out).toContain('timeout')
    })

    it('max-value item gets full bar width', () => {
      const out = render({ type: 'bar', data: ['top 100', 'mid 50'] })
      const lines = out.split('\n')
      const topLine = lines.find(l => l.includes('top'))!
      const midLine = lines.find(l => l.includes('mid'))!
      expect(topLine!.split('█').length).toBeGreaterThan(midLine!.split('█').length)
    })
  })

  describe('flow format', () => {
    it('renders items connected by ──► arrows', () => {
      const out = render({ type: 'flow', data: ['Phase1', 'Phase2', 'Phase3'] })
      expect(out).toBe('Phase1 ──► Phase2 ──► Phase3')
    })
  })

  describe('tree format', () => {
    it('wraps tree lines in fenced code block', () => {
      const out = render({ type: 'tree', data: ['├── src/', '└── dist/'] })
      expect(out).toMatch(/^```/)
      expect(out).toContain('├── src/')
    })
  })

  describe('timeline format', () => {
    it('renders events as a numbered list', () => {
      const out = render({ type: 'timeline', data: ['2024-Q1', '2024-Q2', '2024-Q3'] })
      expect(out).toBe('1. 2024-Q1\n2. 2024-Q2\n3. 2024-Q3')
    })
  })

  describe('json format', () => {
    it('wraps JSON in fenced json code block', () => {
      const out = render({ type: 'json', data: ['{"name":"Alice","age":30}'] })
      expect(out).toMatch(/^```json/)
      expect(out).toContain('"name"')
      expect(out).toContain('"Alice"')
    })

    it('pretty-prints JSON with 2-space indentation', () => {
      const out = render({ type: 'json', data: ['{"a":1}'] })
      expect(out).toContain('  "a": 1')
    })
  })

  describe('unknown type', () => {
    it('throws with informative message for unknown type', () => {
      expect(() => render({ type: 'unknown' as never, data: [] })).toThrow(/unknown render type/i)
    })

    it('error message lists valid types', () => {
      let msg = ''
      try { render({ type: 'unknown' as never, data: [] }) } catch (e) { msg = String(e) }
      expect(msg).toContain('list')
    })
  })
})
