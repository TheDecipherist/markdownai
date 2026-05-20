import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

function render(source: string, consumer?: string): string {
  const ast = parse(source)
  return execute(ast, { ctx: consumer ? { consumer } : {} }).output
}

describe('@prompt execution', () => {
  it('renders prompt body with AI instruction markers for consumer=ai', () => {
    const out = render('@markdownai\n@prompt\nAlways be concise.\n@end', 'ai')
    expect(out).toContain('AI INSTRUCTION')
    expect(out).toContain('Always be concise.')
  })

  it('includes role in AI instruction marker', () => {
    const out = render('@markdownai\n@prompt role="constraint"\nDo not hallucinate.\n@end', 'ai')
    expect(out).toContain('constraint')
    expect(out).toContain('Do not hallucinate.')
  })

  it('renders as a note/callout for human consumer', () => {
    const out = render('@markdownai\n@prompt role="context"\nFollow the rules.\n@end', 'human')
    expect(out).toContain('Follow the rules.')
    expect(out).not.toContain('AI INSTRUCTION')
  })

  it('renders as a note/callout when no consumer is set', () => {
    const out = render('@markdownai\n@prompt\nCalibrate.\n@end')
    expect(out).toContain('Calibrate.')
    expect(out).not.toContain('AI INSTRUCTION')
  })

  it('does not omit prompt content regardless of consumer', () => {
    const human = render('@markdownai\n@prompt\nInstruction text.\n@end', 'human')
    const ai = render('@markdownai\n@prompt\nInstruction text.\n@end', 'ai')
    expect(human).toContain('Instruction text.')
    expect(ai).toContain('Instruction text.')
  })

  it('does not bleed AI instruction markers into human output', () => {
    const out = render('@markdownai\nBefore.\n@prompt\nInstruction.\n@end\nAfter.', 'human')
    expect(out).toContain('Before.')
    expect(out).toContain('After.')
    expect(out).not.toContain('AI INSTRUCTION')
  })
})
