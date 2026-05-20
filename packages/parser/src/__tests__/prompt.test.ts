import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { PromptNode } from '../types.js'

const DOC = '@markdownai\n'

function prompt(src: string): PromptNode | undefined {
  return parse(src).nodes.find(n => n.type === 'prompt') as PromptNode | undefined
}

describe('@prompt parser', () => {
  it('parses a basic prompt block', () => {
    const n = prompt(`${DOC}@prompt\n  Do this task carefully.\n@end`)
    expect(n).toBeDefined()
    expect(n?.type).toBe('prompt')
  })

  it('captures the prompt body', () => {
    const n = prompt(`${DOC}@prompt\n  Always respond in JSON format.\n@end`)
    expect(n?.body).toContain('JSON format')
  })

  it('handles multi-line prompt body', () => {
    const n = prompt(`${DOC}@prompt\n  Line one.\n  Line two.\n@end`)
    expect(n?.body).toContain('Line one')
    expect(n?.body).toContain('Line two')
  })

  it('parses the role attribute', () => {
    const n = prompt(`${DOC}@prompt role="constraint"\n  Do not hallucinate.\n@end`)
    expect(n?.role).toBe('constraint')
  })

  it('defaults role when not specified', () => {
    const n = prompt(`${DOC}@prompt\n  Body.\n@end`)
    expect(n).toBeDefined()
  })

  it('parses multiple prompt blocks', () => {
    const src = `${DOC}@prompt\n  First.\n@end\n@prompt role="constraint"\n  Second.\n@end`
    const nodes = parse(src).nodes.filter(n => n.type === 'prompt')
    expect(nodes).toHaveLength(2)
  })

  it('tracks the source line number', () => {
    const src = `${DOC}\n@prompt\n  body\n@end`
    const n = prompt(src)
    expect(n?.line).toBeGreaterThanOrEqual(1)
  })
})
