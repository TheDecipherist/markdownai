import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'

const DOC = '@markdownai\n'

type ConceptNode = { type: string; name: string; definition: string; line: number }

function concept(src: string): ConceptNode | undefined {
  return parse(src).nodes.find(n => n.type === 'define-concept') as ConceptNode | undefined
}

describe('@define-concept parser', () => {
  it('parses a basic define-concept', () => {
    const n = concept(`${DOC}@define-concept jailRoot "The directory that bounds all file access"`)
    expect(n).toBeDefined()
    expect(n?.type).toBe('define-concept')
  })

  it('captures the term and definition', () => {
    const n = concept(`${DOC}@define-concept phaseNode "A named execution checkpoint in a document"`)
    expect(n?.name).toBe('phaseNode')
    expect(n?.definition).toBe('A named execution checkpoint in a document')
  })

  it('parses multiple define-concept declarations', () => {
    const src = `${DOC}@define-concept alpha "First"\n@define-concept beta "Second"`
    const nodes = parse(src).nodes.filter(n => n.type === 'define-concept')
    expect(nodes).toHaveLength(2)
  })

  it('handles terms with hyphens', () => {
    const n = concept(`${DOC}@define-concept doc-root "Root dir for file confinement"`)
    expect(n?.name).toBe('doc-root')
    expect(n?.definition).toBe('Root dir for file confinement')
  })

  it('tracks the source line number', () => {
    const src = `${DOC}\n\n@define-concept term "value"`
    const n = concept(src)
    expect(n).toBeDefined()
    expect(n!.line).toBeGreaterThanOrEqual(2)
  })

  it('handles empty name gracefully', () => {
    const n = concept(`${DOC}@define-concept`)
    expect(n).toBeDefined()
    expect(n?.name).toBe('')
  })
})
