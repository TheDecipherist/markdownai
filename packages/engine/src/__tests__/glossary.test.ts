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

describe('@define-concept — glossary injection /', () => {
  it('injects glossary before body when consumer=ai', () => {
    const out = render('@markdownai\n@define-concept jailRoot "Directory that bounds file access" /\n\nBody.', 'ai')
    expect(out).toContain('## Glossary')
    expect(out).toContain('jailRoot')
    expect(out).toContain('Directory that bounds file access')
    expect(out.indexOf('## Glossary')).toBeLessThan(out.indexOf('Body.'))
  })

  it('does not inject glossary table when consumer is not ai', () => {
    const out = render('@markdownai\n@define-concept foo "bar" /\n\nBody.', 'human')
    expect(out).not.toContain('## Glossary')
  })

  it('includes multiple glossary entries for ai consumer', () => {
    const src = '@markdownai\n@define-concept alpha "First" /\n@define-concept beta "Second" /\n\nDoc.'
    const out = render(src, 'ai')
    expect(out).toContain('alpha')
    expect(out).toContain('beta')
  })

  it('warns on duplicate define-concept term', () => {
    const src = '@markdownai\n@define-concept term "First" /\n@define-concept term "Second" /'
    const w = warnings(src, 'ai')
    expect(w.some(msg => msg.includes('term'))).toBe(true)
  })

  it('renders inline for human consumer', () => {
    const out = render('@markdownai\n@define-concept word "Its meaning" /\n\nDoc.', 'human')
    expect(out).toContain('**word**')
    expect(out).toContain('Its meaning')
  })

  it('renders inline for undefined consumer', () => {
    const out = render('@markdownai\n@define-concept item "The item definition" /\n\nDoc.')
    expect(out).toContain('**item**')
    expect(out).toContain('The item definition')
  })

  it('produces no inline output for ai consumer (glossary replaces inline)', () => {
    const out = render('@markdownai\n@define-concept key "value" /\n\nAfter.', 'ai')
    // No inline **key** — value in the body after the glossary
    const afterSep = out.split('---').slice(-1)[0] ?? ''
    expect(afterSep).not.toContain('**key**')
  })
})
