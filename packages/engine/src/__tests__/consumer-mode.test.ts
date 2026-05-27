import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

function render(source: string, consumer?: string): string {
  const ast = parse(source)
  return execute(ast, { ctx: consumer ? { consumer } : {} }).output
}

describe('@note consumer targeting', () => {
  it('shows visible note with no consumer= to all audiences', () => {
    const out = render('@markdownai\n@note visible\n  All audiences see this.\n@note-end', 'human')
    expect(out).toContain('All audiences see this.')
  })

  it('shows note targeted to ai only to ai consumer', () => {
    const ai = render('@markdownai\n@note visible consumer="ai"\n  AI only.\n@note-end', 'ai')
    const human = render('@markdownai\n@note visible consumer="ai"\n  AI only.\n@note-end', 'human')
    expect(ai).toContain('AI only.')
    expect(human).not.toContain('AI only.')
  })

  it('shows note targeted to human only to human consumer', () => {
    const human = render('@markdownai\n@note visible consumer="human"\n  Human only.\n@note-end', 'human')
    const ai = render('@markdownai\n@note visible consumer="human"\n  Human only.\n@note-end', 'ai')
    expect(human).toContain('Human only.')
    expect(ai).not.toContain('Human only.')
  })
})

describe('@section markers in output', () => {
  it('wraps @section body in mda-section HTML comments', () => {
    const out = render('@markdownai\n@section priority="high"\n  Priority content.\n@section-end')
    expect(out).toContain('<!-- mda-section priority="high"')
    expect(out).toContain('<!-- /mda-section -->')
    expect(out).toContain('Priority content.')
  })

  it('includes id attribute in section marker when id is set', () => {
    const out = render('@markdownai\n@section priority="medium" id="intro"\n  Content.\n@section-end')
    expect(out).toContain('id="intro"')
  })
})

describe('@chunk-boundary rendering /', () => {
  it('renders chunk-boundary as --- marker for ai consumer', () => {
    const out = render('@markdownai\n@chunk-boundary id="c1" /', 'ai')
    expect(out).toContain('---chunk:c1---')
  })

  it('renders chunk-boundary as HTML comment for human consumer', () => {
    const out = render('@markdownai\n@chunk-boundary id="c1" /', 'human')
    expect(out).toContain('<!-- chunk: c1 -->')
  })

  it('defaults to human rendering when no consumer set', () => {
    const out = render('@markdownai\n@chunk-boundary id="c2" /')
    expect(out).toContain('<!-- chunk: c2 -->')
  })
})
