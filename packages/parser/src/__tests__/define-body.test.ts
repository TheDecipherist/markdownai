// Regression tests for @define body parsing.
// Bug: VERBATIM_BODY_DIRECTIVES did not include 'define', so the collectBlock
// function entered an "attribute collection phase" after the opener. Single-word
// lines (e.g. "HELLO", "FROM-B") matched ATTR_REGEX as bare flags and were
// consumed silently instead of becoming body content.

import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'

describe('@define body parsing', () => {
  it('single-word body line is included in define body', () => {
    const src = '@markdownai v1.0\n@define my-macro local\n  HELLO\n@define-end\n'
    const ast = parse(src, { inImport: true })
    const def = ast.nodes.find(n => n.type === 'define')
    expect(def).toBeDefined()
    expect(def!.body).toHaveLength(1)
    expect((def!.body[0] as { text: string }).text).toContain('HELLO')
  })

  it('hyphenated single-word body line is included in define body', () => {
    const src = '@markdownai v1.0\n@define my-macro local\n  FROM-B\n@define-end\n'
    const ast = parse(src, { inImport: true })
    const def = ast.nodes.find(n => n.type === 'define')
    expect(def).toBeDefined()
    expect(def!.body).toHaveLength(1)
  })

  it('multi-word body line is included (was already working)', () => {
    const src = '@markdownai v1.0\n@define my-macro local\n  PLAIN TEXT\n@define-end\n'
    const ast = parse(src, { inImport: true })
    const def = ast.nodes.find(n => n.type === 'define')
    expect(def).toBeDefined()
    expect(def!.body).toHaveLength(1)
  })

  it('hyphenated macro name does not affect body parsing', () => {
    const src = '@markdownai v1.0\n@define apply-build-checklist-express local\n  EXPRESS RULES\n@define-end\n'
    const ast = parse(src, { inImport: true })
    const def = ast.nodes.find(n => n.type === 'define')
    expect(def).toBeDefined()
    expect(def!.name).toBe('apply-build-checklist-express')
    expect(def!.body.length).toBeGreaterThan(0)
  })

  it('define body with @prompt instruction is preserved', () => {
    const src = [
      '@markdownai v1.0',
      '@define my-macro local',
      '  @prompt instruction',
      '  Check something.',
      '  @prompt-end',
      '@define-end',
    ].join('\n')
    const ast = parse(src, { inImport: true })
    const def = ast.nodes.find(n => n.type === 'define')
    expect(def).toBeDefined()
    const promptNode = def!.body.find((n: { type: string }) => n.type === 'prompt')
    expect(promptNode).toBeDefined()
  })
})
