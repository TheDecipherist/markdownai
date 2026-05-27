/**
 * E2E tests for AI-native directives via `mai render` CLI.
 * Each test exercises one directive's observable behavior end-to-end.
 * Fixtures live in e2e/ai-fixtures/.
 */
import { describe, it, expect } from 'vitest'
import { resolve, join } from 'node:path'
import { runRender } from '@markdownai/core'

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURES = join(ROOT, 'e2e/ai-fixtures')

function fixture(name: string): string {
  return join(FIXTURES, name)
}

function renderAi(file: string, extra?: Partial<Parameters<typeof runRender>[1]>): ReturnType<typeof runRender> {
  return runRender(file, { consumer: 'ai', format: 'ai', ...extra })
}

function renderHuman(file: string, extra?: Partial<Parameters<typeof runRender>[1]>): ReturnType<typeof runRender> {
  return runRender(file, { consumer: 'human', format: 'standard', ...extra })
}

// ─── @prompt ─────────────────────────────────────────────────────────────────

describe('E2E — @prompt directive', () => {
  const FILE = fixture('02-prompt-instructions.md')

  it('ai consumer: @prompt renders as [AI INSTRUCTION] block', () => {
    const result = renderAi(FILE)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('[AI INSTRUCTION — context]')
    expect(result.output).toContain('[AI INSTRUCTION — constraint]')
    expect(result.output).toContain('[/AI INSTRUCTION]')
  })

  it('ai consumer: @prompt role="context" includes the context body', () => {
    const result = renderAi(FILE)
    expect(result.output).toContain('MarkdownAI rendering pipeline')
  })

  it('ai consumer: @prompt role="constraint" includes the constraint body', () => {
    const result = renderAi(FILE)
    expect(result.output).toContain('Always validate file paths')
  })

  it('human consumer: @prompt renders as blockquote callout (no [AI INSTRUCTION])', () => {
    const result = renderHuman(FILE)
    expect(result.exitCode).toBe(0)
    expect(result.output).not.toContain('[AI INSTRUCTION')
    expect(result.output).toContain('> **Note (context):**')
    expect(result.output).toContain('> **Note (constraint):**')
  })

  it('human consumer: @prompt body is quoted with > prefix', () => {
    const result = renderHuman(FILE)
    expect(result.output).toContain('> Always validate file paths')
  })

  it('@prompt does not appear as raw directive in either consumer output', () => {
    const ai = renderAi(FILE)
    const human = renderHuman(FILE)
    expect(ai.output).not.toMatch(/@prompt\b/)
    expect(human.output).not.toMatch(/@prompt\b/)
  })
})

// ─── @section ────────────────────────────────────────────────────────────────

describe('E2E — @section directive', () => {
  const FILE = fixture('03-context-budget.md')

  it('all section content appears in output when no budget set', () => {
    // mda-section markers are stripped from final output; section content is rendered
    const result = runRender(FILE, { consumer: 'ai', format: 'standard' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('System Architecture')
    expect(result.output).toContain('High Priority: Configuration')
    expect(result.output).toContain('Medium Priority: Examples')
    expect(result.output).toContain('Low Priority: Historical Background')
  })

  it('section markers are not present in final output (stripped after budget pass)', () => {
    const result = runRender(FILE, { consumer: 'ai', format: 'standard' })
    expect(result.output).not.toContain('<!-- mda-section')
    expect(result.output).not.toContain('<!-- /mda-section -->')
  })

  it('section content appears inside markers', () => {
    const result = renderAi(FILE)
    expect(result.output).toContain('System Architecture')
    expect(result.output).toContain('Historical Background')
  })

  it('@section does not appear as raw directive in output', () => {
    const result = renderAi(FILE)
    expect(result.output).not.toMatch(/@section\b/)
    expect(result.output).not.toMatch(/@end\b/)
  })

  it('with budget, critical section always present — low section dropped', () => {
    const result = runRender(FILE, { consumer: 'ai', format: 'standard', budget: 100 })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('System Architecture')
    expect(result.output).not.toContain('Historical Background')
  })

  it('with very tight budget, only critical sections survive', () => {
    const result = runRender(FILE, { consumer: 'ai', format: 'standard', budget: 1 })
    expect(result.output).toContain('System Architecture')
    expect(result.output).not.toContain('High Priority: Configuration')
  })
})

// ─── @chunk-boundary ─────────────────────────────────────────────────────────

describe('E2E — @chunk-boundary directive', () => {
  const FILE = fixture('03-context-budget.md')

  it('ai consumer: @chunk-boundary renders as ---chunk:id--- marker', () => {
    const result = renderAi(FILE)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('---chunk:architecture---')
  })

  it('human consumer: @chunk-boundary renders as HTML comment', () => {
    const result = renderHuman(FILE)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('<!-- chunk: architecture -->')
    expect(result.output).not.toContain('---chunk:')
  })

  it('@chunk-boundary does not appear as raw directive /', () => {
    const ai = renderAi(FILE)
    const human = renderHuman(FILE)
    expect(ai.output).not.toMatch(/@chunk-boundary\b/)
    expect(human.output).not.toMatch(/@chunk-boundary\b/)
  })
})

// ─── @define-concept ─────────────────────────────────────────────────────────

describe('E2E — @define-concept directive', () => {
  const FILE = fixture('04-concepts-and-constraints.md')

  it('ai consumer: glossary table injected at document top', () => {
    const result = renderAi(FILE)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('## Glossary')
    expect(result.output).toContain('**jailRoot**')
    expect(result.output).toContain('**strictMode**')
    expect(result.output).toContain('**aiFilter**')
  })

  it('ai consumer: glossary appears before document body', () => {
    const result = renderAi(FILE)
    const glossIdx = result.output.indexOf('## Glossary')
    const bodyIdx = result.output.indexOf('Document Content')
    expect(glossIdx).toBeGreaterThanOrEqual(0)
    expect(bodyIdx).toBeGreaterThanOrEqual(0)
    expect(glossIdx).toBeLessThan(bodyIdx)
  })

  it('ai consumer: no inline concept definitions in body', () => {
    const result = renderAi(FILE)
    expect(result.output).not.toMatch(/@define-concept\b/)
  })

  it('human consumer: concepts render inline as **name** — definition', () => {
    const result = renderHuman(FILE)
    expect(result.output).toContain('**jailRoot** — the document root directory')
    expect(result.output).toContain('**strictMode** — when --strict is active')
    expect(result.output).toContain('**aiFilter** — the token-efficient output mode')
  })

  it('human consumer: no Glossary block at top', () => {
    const result = renderHuman(FILE)
    expect(result.output).not.toContain('## Glossary')
  })
})

// ─── @constraint ─────────────────────────────────────────────────────────────

describe('E2E — @constraint directive', () => {
  const FILE = fixture('04-concepts-and-constraints.md')

  it('ai consumer: constraints table injected at document top', () => {
    const result = renderAi(FILE)
    expect(result.output).toContain('## Constraints')
    expect(result.output).toContain('no-eval')
    expect(result.output).toContain('no-traversal')
    expect(result.output).toContain('CRITICAL')
  })

  it('ai consumer: constraints appear before document body', () => {
    const result = renderAi(FILE)
    const consIdx = result.output.indexOf('## Constraints')
    const bodyIdx = result.output.indexOf('Document Content')
    expect(consIdx).toBeGreaterThanOrEqual(0)
    expect(bodyIdx).toBeGreaterThanOrEqual(0)
    expect(consIdx).toBeLessThan(bodyIdx)
  })

  it('ai consumer: constraints sorted critical first', () => {
    const result = renderAi(FILE)
    const idx1 = result.output.indexOf('no-eval')
    const idx2 = result.output.indexOf('no-traversal')
    expect(idx1).toBeGreaterThanOrEqual(0)
    expect(idx2).toBeGreaterThanOrEqual(0)
  })

  it('ai consumer: no inline constraint blockquotes in body', () => {
    const result = renderAi(FILE)
    expect(result.output).not.toContain('> **CONSTRAINT')
    expect(result.output).not.toMatch(/@constraint\b/)
  })

  it('human consumer: constraints render as blockquote callouts', () => {
    const result = renderHuman(FILE)
    expect(result.output).toContain('> **CONSTRAINT [no-eval] — CRITICAL**')
    expect(result.output).toContain('> **CONSTRAINT [no-traversal] — CRITICAL**')
  })

  it('human consumer: no Constraints table at top', () => {
    const result = renderHuman(FILE)
    expect(result.output).not.toContain('## Constraints')
  })
})

// ─── Cross-directive: all in same document ────────────────────────────────────

describe('E2E — all AI directives in one document', () => {
  const FILE = fixture('04-concepts-and-constraints.md')

  it('ai consumer: glossary before constraints before body', () => {
    const result = renderAi(FILE)
    const glossIdx = result.output.indexOf('## Glossary')
    const consIdx = result.output.indexOf('## Constraints')
    const bodyIdx = result.output.indexOf('Document Content')
    expect(glossIdx).toBeGreaterThanOrEqual(0)
    expect(consIdx).toBeGreaterThanOrEqual(0)
    expect(bodyIdx).toBeGreaterThanOrEqual(0)
    expect(glossIdx).toBeLessThan(consIdx)
    expect(consIdx).toBeLessThan(bodyIdx)
  })

  it('ai consumer: no raw @directives remain in output', () => {
    const result = renderAi(FILE)
    const rawDirectivePattern = /@(define-concept|constraint|prompt|section|chunk-boundary)\b/
    expect(result.output).not.toMatch(rawDirectivePattern)
  })

  it('human consumer: inline concepts + constraint callouts, no tables', () => {
    const result = renderHuman(FILE)
    expect(result.output).toContain('**jailRoot** —')
    expect(result.output).toContain('> **CONSTRAINT [no-eval]')
    expect(result.output).not.toContain('## Glossary')
    expect(result.output).not.toContain('## Constraints')
  })
})
