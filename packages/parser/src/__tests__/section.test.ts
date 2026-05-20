import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { SectionNode } from '../types.js'

const DOC = '@markdownai\n'

function section(src: string): SectionNode | undefined {
  return parse(src).nodes.find(n => n.type === 'section') as SectionNode | undefined
}

describe('@section parser', () => {
  it('parses a section with default priority medium', () => {
    const n = section(`${DOC}@section\n  Content.\n@end`)
    expect(n).toBeDefined()
    expect(n?.priority).toBe('medium')
  })

  it('parses all priority levels', () => {
    for (const priority of ['critical', 'high', 'medium', 'low'] as const) {
      const n = section(`${DOC}@section priority="${priority}"\n  body\n@end`)
      expect(n?.priority).toBe(priority)
    }
  })

  it('section body is an array of AST nodes', () => {
    const n = section(`${DOC}@section priority="high"\n  Content here.\n@end`)
    expect(Array.isArray(n?.body)).toBe(true)
    expect(n?.body.length).toBeGreaterThan(0)
  })

  it('parses section with id attribute', () => {
    const n = section(`${DOC}@section id="intro" priority="high"\n  intro content\n@end`)
    expect(n?.id).toBe('intro')
  })

  it('id defaults to null when not specified', () => {
    const n = section(`${DOC}@section priority="low"\n  body\n@end`)
    expect(n?.id).toBeNull()
  })

  it('parses multiple sections', () => {
    const src = `${DOC}@section priority="critical"\n  A\n@end\n@section priority="low"\n  B\n@end`
    const nodes = parse(src).nodes.filter(n => n.type === 'section') as SectionNode[]
    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.priority).toBe('critical')
    expect(nodes[1]?.priority).toBe('low')
  })

  it('tracks the line number', () => {
    const n = section(`${DOC}\n@section priority="high"\n  body\n@end`)
    expect(n?.line).toBeGreaterThanOrEqual(1)
  })
})
