import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

function render(source: string, consumer?: string): string {
  const ast = parse(source)
  return execute(ast, { ctx: consumer ? { consumer } : {} }).output
}

function warnings(source: string, consumer?: string): string[] {
  const ast = parse(source)
  return execute(ast, { ctx: consumer ? { consumer } : {} }).warnings
}

describe('@constraint — ai consumer injects constraints table', () => {
  it('injects a constraints table before body when consumer=ai', () => {
    const out = render('@markdownai\n@constraint id="c1" severity="critical"\nNo eval()\n@constraint-end\n\nBody text.', 'ai')
    expect(out).toContain('## Constraints')
    expect(out).toContain('CRITICAL')
    expect(out).toContain('No eval')
    expect(out).toContain('Body text.')
    expect(out.indexOf('## Constraints')).toBeLessThan(out.indexOf('Body text.'))
  })

  it('sorts constraints by severity (critical first, low last)', () => {
    const src = '@markdownai\n@constraint id="l" severity="low"\nLow rule\n@constraint-end\n@constraint id="c" severity="critical"\nCritical rule\n@constraint-end\n\nBody.'
    const out = render(src, 'ai')
    expect(out.indexOf('CRITICAL')).toBeLessThan(out.indexOf('LOW'))
  })

  it('renders as blockquote for human consumer', () => {
    const out = render('@markdownai\n@constraint id="r1" severity="high"\nHigh rule.\n@constraint-end', 'human')
    expect(out).toContain('CONSTRAINT')
    expect(out).toContain('r1')
    expect(out).not.toContain('## Constraints')
  })

  it('renders as blockquote when no consumer is set', () => {
    const out = render('@markdownai\n@constraint id="r2"\nRule body.\n@constraint-end')
    expect(out).toContain('CONSTRAINT')
  })

  it('warns on duplicate constraint id', () => {
    const src = '@markdownai\n@constraint id="dup"\nFirst\n@constraint-end\n@constraint id="dup"\nDuplicate\n@constraint-end'
    const w = warnings(src, 'ai')
    expect(w.some(msg => msg.includes('dup'))).toBe(true)
  })

  it('inline output is empty for ai consumer', () => {
    const out = render('@markdownai\n@constraint id="c2" severity="medium"\nRule\n@constraint-end\n\nAfter.', 'ai')
    const parts = out.split('---')
    const body = parts[parts.length - 1] ?? out
    expect(body).not.toContain('CONSTRAINT')
  })
})
