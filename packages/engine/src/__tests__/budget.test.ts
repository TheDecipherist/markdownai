import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

function render(source: string): string {
  const ast = parse(source)
  return execute(ast, {}).output
}

describe('@section — mda-section markers in engine output', () => {
  it('wraps section content in mda-section markers', () => {
    const out = render('@markdownai\n@section priority="critical"\n  Must-see content.\n@section-end')
    expect(out).toContain('<!-- mda-section priority="critical" -->')
    expect(out).toContain('<!-- /mda-section -->')
    expect(out).toContain('Must-see content.')
  })

  it('emits correct priority for each severity level', () => {
    for (const p of ['critical', 'high', 'medium', 'low']) {
      const out = render(`@markdownai\n@section priority="${p}"\n  body\n@section-end`)
      expect(out).toContain(`priority="${p}"`)
    }
  })

  it('includes id in marker when set', () => {
    const out = render('@markdownai\n@section priority="high" id="summary"\n  content\n@section-end')
    expect(out).toContain('id="summary"')
  })

  it('produces well-formed open/close markers for each section', () => {
    const src = '@markdownai\n@section priority="high"\n  A\n@section-end\n@section priority="low"\n  B\n@section-end'
    const out = render(src)
    const opens = [...out.matchAll(/<!-- mda-section /g)].length
    const closes = [...out.matchAll(/<!-- \/mda-section -->/g)].length
    expect(opens).toBe(2)
    expect(closes).toBe(2)
  })

  it('preserves content between markers verbatim', () => {
    const body = 'Exact content preserved here'
    const out = render(`@markdownai\n@section priority="medium"\n  ${body}\n@section-end`)
    expect(out).toContain(body)
  })
})
