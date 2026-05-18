import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { ASTNode, PromptNode, SectionNode, ConceptNode, ConstraintNode, ChunkBoundaryNode } from '../types.js'

function node<T extends ASTNode>(nodes: ASTNode[], idx: number): T {
  return nodes[idx] as T
}

// ─── AI-native directives ─────────────────────────────────────────────────────

describe('Parser — @prompt directive', () => {
  it('parses @prompt with default role', () => {
    const result = parse('@markdownai\n@prompt\nYou are a helpful assistant.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.type).toBe('prompt')
    expect(n.role).toBe('context')
    expect(n.body).toContain('helpful assistant')
  })

  it('parses @prompt role="context"', () => {
    const result = parse('@markdownai\n@prompt role="context"\nContext body.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.role).toBe('context')
  })

  it('parses @prompt role="constraint"', () => {
    const result = parse('@markdownai\n@prompt role="constraint"\nNever do X.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.role).toBe('constraint')
    expect(n.body).toContain('Never do X')
  })

  it('parses @prompt role="calibration"', () => {
    const result = parse('@markdownai\n@prompt role="calibration"\nCalibrate tone.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.role).toBe('calibration')
  })

  it('parses @prompt role="instruction"', () => {
    const result = parse('@markdownai\n@prompt role="instruction"\nDo this step.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.role).toBe('instruction')
  })

  it('accepts unknown role for forward compatibility', () => {
    const result = parse('@markdownai\n@prompt role="custom-role"\nBody.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.type).toBe('prompt')
    expect(n.role).toBe('custom-role')
  })

  it('multiline body is captured', () => {
    const result = parse('@markdownai\n@prompt\nLine one.\nLine two.\nLine three.\n@end')
    const n = node<PromptNode>(result.nodes, 1)
    expect(n.body).toContain('Line one')
    expect(n.body).toContain('Line two')
    expect(n.body).toContain('Line three')
  })
})

describe('Parser — @section directive', () => {
  it('parses @section with default priority medium', () => {
    const result = parse('@markdownai\n@section\nContent.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(n.type).toBe('section')
    expect(n.priority).toBe('medium')
    expect(n.id).toBeNull()
  })

  it('parses @section priority="critical"', () => {
    const result = parse('@markdownai\n@section priority="critical"\nMust include.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(n.priority).toBe('critical')
  })

  it('parses @section priority="high"', () => {
    const result = parse('@markdownai\n@section priority="high"\nImportant.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(n.priority).toBe('high')
  })

  it('parses @section priority="low"', () => {
    const result = parse('@markdownai\n@section priority="low"\nNice to have.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(n.priority).toBe('low')
  })

  it('parses @section with id attribute', () => {
    const result = parse('@markdownai\n@section id="intro" priority="high"\nIntro text.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(n.id).toBe('intro')
    expect(n.priority).toBe('high')
  })

  it('parses @section positional id', () => {
    const result = parse('@markdownai\n@section "my-section"\nBody.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(n.id).toBe('my-section')
  })

  it('throws on unknown priority', () => {
    expect(() => parse('@markdownai\n@section priority="extreme"\nBody.\n@end')).toThrow('invalid priority')
  })

  it('section body contains child nodes', () => {
    const result = parse('@markdownai\n@section priority="high"\nChild text.\n@end')
    const n = node<SectionNode>(result.nodes, 1)
    expect(Array.isArray(n.body)).toBe(true)
    expect(n.body.length).toBeGreaterThan(0)
  })
})

describe('Parser — @define-concept directive', () => {
  it('parses @define-concept with name and definition', () => {
    const result = parse('@markdownai\n@define-concept jailRoot "Root directory that confines file access"')
    const n = node<ConceptNode>(result.nodes, 1)
    expect(n.type).toBe('define-concept')
    expect(n.name).toBe('jailRoot')
    expect(n.definition).toBe('Root directory that confines file access')
  })

  it('parses @define-concept single-word name', () => {
    const result = parse('@markdownai\n@define-concept consumer "The entity reading the document"')
    const n = node<ConceptNode>(result.nodes, 1)
    expect(n.name).toBe('consumer')
    expect(n.definition).toBe('The entity reading the document')
  })

  it('parses multiple @define-concept directives', () => {
    const result = parse('@markdownai\n@define-concept alpha "First"\n@define-concept beta "Second"')
    const a = node<ConceptNode>(result.nodes, 1)
    const b = node<ConceptNode>(result.nodes, 2)
    expect(a.name).toBe('alpha')
    expect(b.name).toBe('beta')
  })

  it('empty name yields empty string (no crash)', () => {
    const result = parse('@markdownai\n@define-concept')
    const n = node<ConceptNode>(result.nodes, 1)
    expect(n.type).toBe('define-concept')
    expect(n.name).toBe('')
  })
})

describe('Parser — @constraint directive', () => {
  it('parses @constraint with id and default severity high', () => {
    const result = parse('@markdownai\n@constraint id="no-pii"\nNever expose PII.\n@end')
    const n = node<ConstraintNode>(result.nodes, 1)
    expect(n.type).toBe('constraint')
    expect(n.id).toBe('no-pii')
    expect(n.severity).toBe('high')
    expect(n.body).toContain('Never expose PII')
  })

  it('parses @constraint severity="critical"', () => {
    const result = parse('@markdownai\n@constraint id="safety" severity="critical"\nSafety rule.\n@end')
    const n = node<ConstraintNode>(result.nodes, 1)
    expect(n.severity).toBe('critical')
  })

  it('parses @constraint severity="medium"', () => {
    const result = parse('@markdownai\n@constraint id="style" severity="medium"\nStyle rule.\n@end')
    const n = node<ConstraintNode>(result.nodes, 1)
    expect(n.severity).toBe('medium')
  })

  it('parses @constraint severity="low"', () => {
    const result = parse('@markdownai\n@constraint id="nice" severity="low"\nNice to follow.\n@end')
    const n = node<ConstraintNode>(result.nodes, 1)
    expect(n.severity).toBe('low')
  })

  it('throws on unknown severity', () => {
    expect(() => parse('@markdownai\n@constraint id="x" severity="extreme"\nBody.\n@end')).toThrow('invalid severity')
  })

  it('uses positional id when no id= named arg', () => {
    const result = parse('@markdownai\n@constraint "my-rule"\nBody.\n@end')
    const n = node<ConstraintNode>(result.nodes, 1)
    expect(n.id).toBe('my-rule')
  })

  it('generates line-based id when no id provided', () => {
    const result = parse('@markdownai\n@constraint\nBody.\n@end')
    const n = node<ConstraintNode>(result.nodes, 1)
    expect(n.id).toMatch(/^constraint-\d+$/)
  })
})

describe('Parser — @chunk-boundary directive', () => {
  it('parses @chunk-boundary with id', () => {
    const result = parse('@markdownai\n@chunk-boundary id="section-1"')
    const n = node<ChunkBoundaryNode>(result.nodes, 1)
    expect(n.type).toBe('chunk-boundary')
    expect(n.id).toBe('section-1')
    expect(n.standalone).toBe(false)
  })

  it('parses @chunk-boundary positional id', () => {
    const result = parse('@markdownai\n@chunk-boundary "my-chunk"')
    const n = node<ChunkBoundaryNode>(result.nodes, 1)
    expect(n.id).toBe('my-chunk')
  })

  it('parses @chunk-boundary standalone=true', () => {
    const result = parse('@markdownai\n@chunk-boundary id="sep" standalone="true"')
    const n = node<ChunkBoundaryNode>(result.nodes, 1)
    expect(n.standalone).toBe(true)
  })

  it('generates line-based id when no id provided', () => {
    const result = parse('@markdownai\n@chunk-boundary')
    const n = node<ChunkBoundaryNode>(result.nodes, 1)
    expect(n.id).toMatch(/^chunk-\d+$/)
  })

  it('@chunk-boundary is inline (not a block directive)', () => {
    const result = parse('@markdownai\nParagraph before.\n@chunk-boundary id="mid"\nParagraph after.')
    expect(result.nodes.length).toBe(4)
    const n = node<ChunkBoundaryNode>(result.nodes, 2)
    expect(n.type).toBe('chunk-boundary')
  })
})
