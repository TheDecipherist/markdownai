import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

function render(source: string, consumer?: string): string {
  const ast = parse(source)
  const result = execute(ast, { ctx: consumer ? { consumer } : undefined })
  return result.output
}

function warnings(source: string, consumer?: string): string[] {
  const ast = parse(source)
  return execute(ast, { ctx: consumer ? { consumer } : undefined }).warnings
}

// ─── @prompt ─────────────────────────────────────────────────────────────────

describe('@prompt — consumer=ai', () => {
  it('wraps body in [AI INSTRUCTION] delimiters', () => {
    const out = render('@markdownai\n@prompt role="context"\nYou are an assistant.\n@end', 'ai')
    expect(out).toContain('[AI INSTRUCTION — context]')
    expect(out).toContain('You are an assistant.')
    expect(out).toContain('[/AI INSTRUCTION]')
  })

  it('uses role in the delimiter line', () => {
    const out = render('@markdownai\n@prompt role="constraint"\nDo not lie.\n@end', 'ai')
    expect(out).toContain('[AI INSTRUCTION — constraint]')
  })

  it('default role is context', () => {
    const out = render('@markdownai\n@prompt\nDefault role body.\n@end', 'ai')
    expect(out).toContain('[AI INSTRUCTION — context]')
  })
})

describe('@prompt — consumer=human', () => {
  it('renders as blockquote callout', () => {
    const out = render('@markdownai\n@prompt role="constraint"\nFollow the rules.\n@end', 'human')
    expect(out).toContain('> **Note (constraint):**')
    expect(out).toContain('> Follow the rules.')
  })

  it('does not include [AI INSTRUCTION] markers', () => {
    const out = render('@markdownai\n@prompt\nBody.\n@end', 'human')
    expect(out).not.toContain('[AI INSTRUCTION')
  })
})

describe('@prompt — no consumer', () => {
  it('falls back to human rendering when consumer is unset', () => {
    const out = render('@markdownai\n@prompt role="calibration"\nCalibrate.\n@end')
    expect(out).toContain('> **Note (calibration):**')
  })
})

// ─── @section ────────────────────────────────────────────────────────────────

describe('@section', () => {
  it('wraps content in mda-section markers', () => {
    const out = render('@markdownai\n@section priority="high"\nImportant content.\n@end')
    expect(out).toContain('<!-- mda-section priority="high" -->')
    expect(out).toContain('Important content.')
    expect(out).toContain('<!-- /mda-section -->')
  })

  it('includes id in section marker when set', () => {
    const out = render('@markdownai\n@section id="intro" priority="critical"\nIntro.\n@end')
    expect(out).toContain('<!-- mda-section priority="critical" id="intro" -->')
  })

  it('omits id attribute when not provided', () => {
    const out = render('@markdownai\n@section priority="low"\nContent.\n@end')
    expect(out).toContain('<!-- mda-section priority="low" -->')
    expect(out).not.toContain(' id=')
  })

  it('default priority medium is output in marker', () => {
    const out = render('@markdownai\n@section\nContent.\n@end')
    expect(out).toContain('priority="medium"')
  })

  it('renders child nodes inside section', () => {
    const out = render('@markdownai\n@section priority="high"\nChild paragraph.\n@end')
    expect(out).toContain('Child paragraph.')
  })
})

// ─── @chunk-boundary ─────────────────────────────────────────────────────────

describe('@chunk-boundary — consumer=ai', () => {
  it('renders as ---chunk:id--- marker', () => {
    const out = render('@markdownai\n@chunk-boundary id="section-1"', 'ai')
    expect(out).toBe('---chunk:section-1---')
  })

  it('uses the id in the marker', () => {
    const out = render('@markdownai\n@chunk-boundary id="my-part"', 'ai')
    expect(out).toContain('---chunk:my-part---')
  })
})

describe('@chunk-boundary — consumer=human', () => {
  it('renders as HTML comment', () => {
    const out = render('@markdownai\n@chunk-boundary id="sep"', 'human')
    expect(out).toBe('<!-- chunk: sep -->')
  })

  it('does not render ---chunk: markers', () => {
    const out = render('@markdownai\n@chunk-boundary id="sep"', 'human')
    expect(out).not.toContain('---chunk:')
  })
})

describe('@chunk-boundary — no consumer', () => {
  it('defaults to human rendering', () => {
    const out = render('@markdownai\n@chunk-boundary id="mid"')
    expect(out).toBe('<!-- chunk: mid -->')
  })
})

// ─── @define-concept ─────────────────────────────────────────────────────────

describe('@define-concept — consumer=ai', () => {
  it('produces no inline output for ai consumer', () => {
    const out = render('@markdownai\n@define-concept jailRoot "Root directory for confinement"\n\nContent.', 'ai')
    expect(out).not.toContain('@define-concept')
    expect(out).toContain('Content.')
  })

  it('injects glossary table at top of document for ai consumer', () => {
    const out = render('@markdownai\n@define-concept alpha "First Greek letter"\n\nBody text.', 'ai')
    expect(out).toContain('## Glossary')
    expect(out).toContain('**alpha** — First Greek letter')
    const glossaryIdx = out.indexOf('## Glossary')
    const bodyIdx = out.indexOf('Body text.')
    expect(glossaryIdx).toBeLessThan(bodyIdx)
  })

  it('injects all defined concepts in glossary', () => {
    const src = '@markdownai\n@define-concept alpha "First"\n@define-concept beta "Second"\n\nBody.'
    const out = render(src, 'ai')
    expect(out).toContain('**alpha** — First')
    expect(out).toContain('**beta** — Second')
  })

  it('warns on duplicate concept name', () => {
    const src = '@markdownai\n@define-concept foo "First"\n@define-concept foo "Second"'
    const w = warnings(src, 'ai')
    expect(w.some(m => m.includes('"foo" redefined'))).toBe(true)
  })
})

describe('@define-concept — consumer=human', () => {
  it('renders inline as **name** — definition', () => {
    const out = render('@markdownai\n@define-concept consumer "The document reader"', 'human')
    expect(out).toContain('**consumer** — The document reader')
  })

  it('does not inject a glossary block for human consumer', () => {
    const out = render('@markdownai\n@define-concept foo "Bar"\n\nContent.', 'human')
    expect(out).not.toContain('## Glossary')
  })
})

describe('@define-concept — no consumer', () => {
  it('defaults to human-style inline rendering', () => {
    const out = render('@markdownai\n@define-concept thing "A thing"')
    expect(out).toContain('**thing** — A thing')
  })
})

// ─── @constraint ─────────────────────────────────────────────────────────────

describe('@constraint — consumer=ai', () => {
  it('produces no inline blockquote for ai consumer', () => {
    const out = render('@markdownai\n@constraint id="no-pii" severity="critical"\nNever expose PII.\n@end', 'ai')
    expect(out).not.toContain('@constraint')
    // Body appears in the Constraints table header, not as an inline blockquote
    expect(out).not.toContain('> **CONSTRAINT [no-pii]')
  })

  it('injects constraints table at top of document for ai consumer', () => {
    const out = render('@markdownai\n@constraint id="no-pii" severity="critical"\nNever expose PII.\n@end\n\nBody.', 'ai')
    expect(out).toContain('## Constraints')
    expect(out).toContain('no-pii')
    expect(out).toContain('CRITICAL')
    const constraintIdx = out.indexOf('## Constraints')
    const bodyIdx = out.indexOf('Body.')
    expect(constraintIdx).toBeLessThan(bodyIdx)
  })

  it('sorts constraints by severity in the table', () => {
    const src = [
      '@markdownai',
      '@constraint id="low-rule" severity="low"',
      'Low severity.',
      '@end',
      '@constraint id="crit-rule" severity="critical"',
      'Critical.',
      '@end',
      '',
      'Body.',
    ].join('\n')
    const out = render(src, 'ai')
    const critIdx = out.indexOf('crit-rule')
    const lowIdx = out.indexOf('low-rule')
    expect(critIdx).toBeLessThan(lowIdx)
  })

  it('warns on duplicate constraint id', () => {
    const src = '@markdownai\n@constraint id="dup"\nFirst.\n@end\n@constraint id="dup"\nSecond.\n@end'
    const w = warnings(src, 'ai')
    expect(w.some(m => m.includes('"dup" redefined'))).toBe(true)
  })
})

describe('@constraint — consumer=human', () => {
  it('renders as blockquote with id and severity', () => {
    const out = render('@markdownai\n@constraint id="rule-1" severity="high"\nAlways validate input.\n@end', 'human')
    expect(out).toContain('> **CONSTRAINT [rule-1] — HIGH**')
    expect(out).toContain('> Always validate input.')
  })

  it('does not inject a constraints table for human consumer', () => {
    const out = render('@markdownai\n@constraint id="r" severity="low"\nRule.\n@end\n\nContent.', 'human')
    expect(out).not.toContain('## Constraints')
  })
})

describe('@constraint — no consumer', () => {
  it('defaults to human-style blockquote rendering', () => {
    const out = render('@markdownai\n@constraint id="c"\nContent.\n@end')
    expect(out).toContain('> **CONSTRAINT [c]')
  })
})

// ─── injectAiPrefixes — combined glossary + constraints ────────────────────────

describe('injectAiPrefixes — combined glossary and constraints', () => {
  it('glossary appears before constraints table', () => {
    const src = [
      '@markdownai',
      '@define-concept term "A defined term"',
      '@constraint id="rule" severity="high"',
      'Follow it.',
      '@end',
      '',
      'Body.',
    ].join('\n')
    const out = render(src, 'ai')
    expect(out).toContain('## Glossary')
    expect(out).toContain('## Constraints')
    const glossIdx = out.indexOf('## Glossary')
    const consIdx = out.indexOf('## Constraints')
    expect(glossIdx).toBeLessThan(consIdx)
  })

  it('no glossary section when no concepts defined', () => {
    const out = render('@markdownai\n@constraint id="r" severity="low"\nBody.\n@end\n\nText.', 'ai')
    expect(out).not.toContain('## Glossary')
    expect(out).toContain('## Constraints')
  })

  it('no constraints section when no constraints defined', () => {
    const out = render('@markdownai\n@define-concept x "Y"\n\nText.', 'ai')
    expect(out).not.toContain('## Constraints')
    expect(out).toContain('## Glossary')
  })

  it('no prefixes injected when neither concepts nor constraints defined', () => {
    const out = render('@markdownai\n\nJust prose.', 'ai')
    expect(out).not.toContain('## Glossary')
    expect(out).not.toContain('## Constraints')
    expect(out).toBe('Just prose.')
  })
})
