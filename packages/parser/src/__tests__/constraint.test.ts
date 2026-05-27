import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { ConstraintNode } from '../types.js'

const DOC = '@markdownai\n'

function constraint(src: string): ConstraintNode | undefined {
  return parse(src).nodes.find(n => n.type === 'constraint') as ConstraintNode | undefined
}

describe('@constraint parser', () => {
  it('parses a critical constraint', () => {
    const n = constraint(`${DOC}@constraint id="c1" severity="critical"\nMust validate all inputs\n@constraint-end`)
    expect(n).toBeDefined()
    expect(n?.severity).toBe('critical')
    expect(n?.body).toContain('Must validate all inputs')
  })

  it('parses a high severity constraint (default)', () => {
    const n = constraint(`${DOC}@constraint id="h1"\nNo eval()\n@constraint-end`)
    expect(n?.severity).toBe('high')
  })

  it('parses a medium severity constraint', () => {
    const n = constraint(`${DOC}@constraint id="m1" severity="medium"\nLog all requests\n@constraint-end`)
    expect(n?.severity).toBe('medium')
  })

  it('parses a low severity constraint', () => {
    const n = constraint(`${DOC}@constraint id="l1" severity="low"\nPrefer async operations\n@constraint-end`)
    expect(n?.severity).toBe('low')
  })

  it('captures the id attribute', () => {
    const n = constraint(`${DOC}@constraint id="no-sql-injection"\nParameterize all queries\n@constraint-end`)
    expect(n?.id).toBe('no-sql-injection')
  })

  it('generates a line-based id when no id is provided', () => {
    const n = constraint(`${DOC}@constraint\nRule body.\n@constraint-end`)
    expect(n?.id).toMatch(/^constraint-\d+$/)
  })

  it('preserves constraint body text', () => {
    const body = 'All HTTP requests must use HTTPS only'
    const n = constraint(`${DOC}@constraint id="https"\n${body}\n@constraint-end`)
    expect(n?.body).toContain(body)
  })

  it('parses multiple constraints', () => {
    const src = `${DOC}@constraint id="a" severity="critical"\nRule one\n@constraint-end\n@constraint id="b" severity="low"\nRule two\n@constraint-end`
    const nodes = parse(src).nodes.filter(n => n.type === 'constraint') as ConstraintNode[]
    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.severity).toBe('critical')
    expect(nodes[1]?.severity).toBe('low')
  })

  it('throws on unknown severity', () => {
    expect(() => parse(`${DOC}@constraint id="x" severity="extreme"\nBody.\n@constraint-end`)).toThrow()
  })

  it('parses a warning severity constraint', () => {
    const n = constraint(`${DOC}@constraint id="w1" severity="warning"\nField may be deprecated\n@constraint-end`)
    expect(n).toBeDefined()
    expect(n?.severity).toBe('warning')
  })

  it('parses a cosmetic severity constraint', () => {
    const n = constraint(`${DOC}@constraint id="c1" severity="cosmetic"\nPrefer kebab-case in slugs\n@constraint-end`)
    expect(n).toBeDefined()
    expect(n?.severity).toBe('cosmetic')
  })

  it('accepts templated severity values without static validation', () => {
    const n = constraint(`${DOC}@constraint id="t1" severity="{{ this.severity }}"\nDynamic.\n@constraint-end`)
    expect(n).toBeDefined()
    expect(n?.severity).toBe('{{ this.severity }}')
  })

  it('still rejects unknown literal severity even when the file has templated peers', () => {
    expect(() => parse(`${DOC}@constraint id="bad" severity="catastrophic"\nNope.\n@constraint-end`)).toThrow()
  })
})
