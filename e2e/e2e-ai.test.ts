import { describe, it, expect, beforeAll } from 'vitest'
import { resolve, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { RenderResult } from '@markdownai/core'
import { runRender, runStrip, runValidate } from '@markdownai/core'
import { aiFilter } from '@markdownai/renderer'

const ROOT = resolve(import.meta.dirname, '..')
const FIXTURES = join(ROOT, 'e2e/ai-fixtures')
const RENDERED_AI = join(ROOT, 'e2e/rendered-ai')
const BENCHMARKS = join(ROOT, 'e2e/benchmarks')

mkdirSync(RENDERED_AI, { recursive: true })
mkdirSync(BENCHMARKS, { recursive: true })

function fixture(name: string): string {
  return join(FIXTURES, name)
}

function saveRenderedAi(name: string, output: string): void {
  writeFileSync(join(RENDERED_AI, name), output, 'utf8')
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const aiDirectiveTokens = ['@prompt ', '@define-concept', '@constraint ', '@section ', '@chunk-boundary']

function noRawAiDirectives(output: string): void {
  for (const token of aiDirectiveTokens) {
    expect(output, `output must not contain unresolved token "${token.trim()}"`).not.toContain(token)
  }
}

function noRawDirectives(output: string): void {
  const blocked = [
    '@include', '@define ', '@call', '@phase ', '@end\n',
    '@list', '@tree', '@read', '@count', '@date', '@env',
    '@render', '@import', '@if ', '@elseif ', '@else\n', '@if-end',
  ]
  for (const token of blocked) {
    expect(output, `output must not contain unresolved token "${token.trim()}"`).not.toContain(token)
  }
}

// ─── CONSUMER TARGETING ─────────────────────────────────────────────────────

describe('E2E AI — 01 consumer targeting', () => {
  let aiResult: RenderResult
  let humanResult: RenderResult
  let defaultResult: RenderResult

  beforeAll(() => {
    aiResult = runRender(fixture('01-consumer-targeting.md'), { cwd: ROOT, consumer: 'ai' })
    humanResult = runRender(fixture('01-consumer-targeting.md'), { cwd: ROOT, consumer: 'human' })
    defaultResult = runRender(fixture('01-consumer-targeting.md'), { cwd: ROOT })
    if (aiResult.exitCode === 0) saveRenderedAi('01-consumer-targeting-ai.md', aiResult.output)
    if (humanResult.exitCode === 0) saveRenderedAi('01-consumer-targeting-human.md', humanResult.output)
  })

  it('renders with exitCode 0 for all consumers', () => {
    expect(aiResult.exitCode).toBe(0)
    expect(humanResult.exitCode).toBe(0)
    expect(defaultResult.exitCode).toBe(0)
  })

  it('consumer=ai: shows AI-only content, hides human-only content', () => {
    expect(aiResult.output).toContain('AI-Only Section')
    expect(aiResult.output).toContain('Automated analysis pipeline active')
    expect(aiResult.output).not.toContain('Human-Only Section')
    expect(aiResult.output).not.toContain('explore the documentation interactively')
  })

  it('consumer=ai: @if/else picks AI branch', () => {
    expect(aiResult.output).toContain('AI Metadata')
    expect(aiResult.output).not.toContain('Reader Guide')
  })

  it('consumer=human: shows human-only content, hides AI-only content', () => {
    expect(humanResult.output).toContain('Human-Only Section')
    expect(humanResult.output).toContain('explore the documentation interactively')
    expect(humanResult.output).not.toContain('AI-Only Section')
    expect(humanResult.output).not.toContain('Automated analysis pipeline active')
  })

  it('consumer=human: @else branch visible', () => {
    expect(humanResult.output).toContain('Reader Guide')
    expect(humanResult.output).not.toContain('AI Metadata')
  })

  it('no consumer: @if consumer= blocks evaluate false, standard content visible', () => {
    expect(defaultResult.output).toContain('Standard content visible to all consumers')
    expect(defaultResult.output).not.toContain('AI-Only Section')
    expect(defaultResult.output).not.toContain('Human-Only Section')
  })

  it('AI output contains no unresolved directives', () => {
    noRawDirectives(aiResult.output)
    noRawAiDirectives(aiResult.output)
  })

  it('@include resolved — shared intro appears in output /', () => {
    expect(aiResult.output).toContain('Shared Introduction')
  })
})

// ─── PROMPT INSTRUCTIONS ─────────────────────────────────────────────────────

describe('E2E AI — 02 @prompt directive', () => {
  let aiResult: RenderResult
  let humanResult: RenderResult
  let stripResult: { output: string; exitCode: number }

  beforeAll(() => {
    aiResult = runRender(fixture('02-prompt-instructions.md'), { cwd: ROOT, consumer: 'ai' })
    humanResult = runRender(fixture('02-prompt-instructions.md'), { cwd: ROOT, consumer: 'human' })
    stripResult = runStrip(fixture('02-prompt-instructions.md'), {})
    if (aiResult.exitCode === 0) saveRenderedAi('02-prompt-instructions-ai.md', aiResult.output)
    if (humanResult.exitCode === 0) saveRenderedAi('02-prompt-instructions-human.md', humanResult.output)
  })

  it('renders with exitCode 0', () => {
    expect(aiResult.exitCode).toBe(0)
    expect(humanResult.exitCode).toBe(0)
  })

  it('consumer=ai: @prompt renders with [AI INSTRUCTION] prefix', () => {
    expect(aiResult.output).toContain('[AI INSTRUCTION — context]')
    expect(aiResult.output).toContain('[AI INSTRUCTION — constraint]')
    expect(aiResult.output).toContain('[/AI INSTRUCTION]')
  })

  it('consumer=ai: prompt body text is present', () => {
    expect(aiResult.output).toContain('MarkdownAI rendering pipeline')
    expect(aiResult.output).toContain('Never expose credential values')
  })

  it('consumer=human: @prompt renders as blockquote callout', () => {
    expect(humanResult.output).toContain('> **Note (context):**')
    expect(humanResult.output).toContain('> **Note (constraint):**')
  })

  it('consumer=human: prompt body text is present', () => {
    expect(humanResult.output).toContain('MarkdownAI rendering pipeline')
    expect(humanResult.output).toContain('Never expose credential values')
  })

  it('strip output contains no @prompt tokens', () => {
    expect(stripResult.output).not.toContain('@prompt')
    expect(stripResult.output).not.toContain('@end')
  })

  it('output contains no unresolved directives', () => {
    noRawDirectives(aiResult.output)
    noRawAiDirectives(aiResult.output)
  })
})

// ─── CONTEXT BUDGET ──────────────────────────────────────────────────────────

describe('E2E AI — 03 @section priority and budget', () => {
  let nobudgetResult: RenderResult
  let tightBudgetResult: RenderResult
  let veryTightBudgetResult: RenderResult

  beforeAll(() => {
    nobudgetResult = runRender(fixture('03-context-budget.md'), { cwd: ROOT })
    tightBudgetResult = runRender(fixture('03-context-budget.md'), { cwd: ROOT, budget: 150 })
    veryTightBudgetResult = runRender(fixture('03-context-budget.md'), { cwd: ROOT, budget: 10 })
    if (nobudgetResult.exitCode === 0) saveRenderedAi('03-context-budget-nobudget.md', nobudgetResult.output)
    if (tightBudgetResult.exitCode === 0) saveRenderedAi('03-context-budget-tight.md', tightBudgetResult.output)
  })

  it('renders with exitCode 0', () => {
    expect(nobudgetResult.exitCode).toBe(0)
    expect(tightBudgetResult.exitCode).toBe(0)
    expect(veryTightBudgetResult.exitCode).toBe(0)
  })

  it('no budget: all sections render, no section markers in output', () => {
    expect(nobudgetResult.output).toContain('Critical: System Architecture')
    expect(nobudgetResult.output).toContain('High Priority: Configuration')
    expect(nobudgetResult.output).toContain('Medium Priority: Examples')
    expect(nobudgetResult.output).toContain('Low Priority: Historical Background')
    expect(nobudgetResult.output).not.toContain('mda-section')
  })

  it('tight budget: low-priority section dropped, critical always present', () => {
    expect(tightBudgetResult.output).toContain('Critical: System Architecture')
    expect(tightBudgetResult.output).not.toContain('Low Priority: Historical Background')
  })

  it('very tight budget: only critical sections remain', () => {
    expect(veryTightBudgetResult.output).toContain('Critical: System Architecture')
    expect(veryTightBudgetResult.output).not.toContain('Low Priority: Historical Background')
    expect(veryTightBudgetResult.output).not.toContain('Medium Priority: Examples')
  })

  it('@chunk-boundary appears in no-budget output as HTML comment /', () => {
    expect(nobudgetResult.output).toContain('chunk:')
  })

  it('output contains no unresolved directives', () => {
    noRawDirectives(nobudgetResult.output)
    noRawAiDirectives(nobudgetResult.output)
  })
})
