import { describe, it, expect, beforeAll } from 'vitest'
import { resolve, join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import type { RenderResult } from '@markdownai/core'
import { runRender } from '@markdownai/core'
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

// ─── CONCEPTS AND CONSTRAINTS ─────────────────────────────────────────────────

describe('E2E AI — 04 @define-concept and @constraint', () => {
  let aiResult: RenderResult
  let humanResult: RenderResult

  beforeAll(() => {
    aiResult = runRender(fixture('04-concepts-and-constraints.md'), { cwd: ROOT, consumer: 'ai' })
    humanResult = runRender(fixture('04-concepts-and-constraints.md'), { cwd: ROOT, consumer: 'human' })
    if (aiResult.exitCode === 0) saveRenderedAi('04-concepts-constraints-ai.md', aiResult.output)
    if (humanResult.exitCode === 0) saveRenderedAi('04-concepts-constraints-human.md', humanResult.output)
  })

  it('renders with exitCode 0', () => {
    expect(aiResult.exitCode).toBe(0)
    expect(humanResult.exitCode).toBe(0)
  })

  it('consumer=ai: glossary block at document top', () => {
    expect(aiResult.output).toContain('## Glossary')
    const glossaryIdx = aiResult.output.indexOf('## Glossary')
    const contentIdx = aiResult.output.indexOf('## Document Content')
    expect(glossaryIdx).toBeLessThan(contentIdx)
  })

  it('consumer=ai: all 3 concepts in glossary', () => {
    expect(aiResult.output).toContain('jailRoot')
    expect(aiResult.output).toContain('strictMode')
    expect(aiResult.output).toContain('aiFilter')
  })

  it('consumer=ai: constraints table at top before content', () => {
    expect(aiResult.output).toContain('## Constraints')
    const constraintsIdx = aiResult.output.indexOf('## Constraints')
    const contentIdx = aiResult.output.indexOf('## Document Content')
    expect(constraintsIdx).toBeLessThan(contentIdx)
  })

  it('consumer=ai: both constraint IDs in table', () => {
    expect(aiResult.output).toContain('no-eval')
    expect(aiResult.output).toContain('no-traversal')
  })

  it('consumer=human: concepts render in-place as definitions', () => {
    expect(humanResult.output).toContain('**jailRoot**')
    expect(humanResult.output).toContain('**strictMode**')
    expect(humanResult.output).toContain('**aiFilter**')
  })

  it('consumer=human: constraints render as callout blockquotes', () => {
    expect(humanResult.output).toContain('> **CONSTRAINT [no-eval] — CRITICAL**')
    expect(humanResult.output).toContain('> **CONSTRAINT [no-traversal] — CRITICAL**')
  })

  it('output contains no unresolved directives', () => {
    noRawDirectives(aiResult.output)
    noRawAiDirectives(aiResult.output)
  })
})

// ─── AI FORMAT ACCURACY ───────────────────────────────────────────────────────

describe('E2E AI — 05 --format=ai accuracy', () => {
  let standardResult: RenderResult
  let aiResult: RenderResult

  beforeAll(() => {
    standardResult = runRender(fixture('05-format-benchmark.md'), { cwd: ROOT, format: 'standard' })
    aiResult = runRender(fixture('05-format-benchmark.md'), { cwd: ROOT, format: 'ai' })
    if (aiResult.exitCode === 0) saveRenderedAi('05-format-benchmark-ai.md', aiResult.output)
    if (standardResult.exitCode === 0) saveRenderedAi('05-format-benchmark-standard.md', standardResult.output)
  })

  it('renders with exitCode 0', () => {
    expect(standardResult.exitCode).toBe(0)
    expect(aiResult.exitCode).toBe(0)
  })

  it('ai format: all headings preserved', () => {
    const standardHeadings = (standardResult.output.match(/^#{1,6} /gm) ?? []).length
    const aiHeadings = (aiResult.output.match(/^#{1,6} /gm) ?? []).length
    expect(aiHeadings).toBe(standardHeadings)
  })

  it('ai format: all code blocks preserved', () => {
    const standardFences = (standardResult.output.match(/^```/gm) ?? []).length
    const aiFences = (aiResult.output.match(/^```/gm) ?? []).length
    expect(aiFences).toBe(standardFences)
  })

  it('ai format: no horizontal rules remain', () => {
    expect(aiResult.output).not.toMatch(/^---+$/m)
    expect(aiResult.output).not.toMatch(/^\*\*\*+$/m)
  })

  it('ai format: no more than 2 consecutive blank lines', () => {
    expect(aiResult.output).not.toContain('\n\n\n\n')
  })

  it('ai format: blockquotes preserved', () => {
    expect(aiResult.output).toContain('> Important blockquote')
  })

  it('ai format: links preserved', () => {
    expect(aiResult.output).toContain('[MarkdownAI Specification]')
    expect(aiResult.output).toContain('[Parser Documentation]')
  })

  it('ai format: standalone bold label stripped', () => {
    expect(aiResult.output).not.toMatch(/^\*\*Decorative:\*\*\s*$/m)
  })

  it('ai format is shorter than standard', () => {
    expect(aiResult.output.length).toBeLessThan(standardResult.output.length)
  })

  it('aiFilter is idempotent', () => {
    const once = aiFilter(standardResult.output)
    const twice = aiFilter(once)
    expect(twice).toBe(once)
  })

  it('output contains no unresolved directives', () => {
    noRawDirectives(aiResult.output)
    noRawAiDirectives(aiResult.output)
  })
})

// ─── BENCHMARK REPORT ─────────────────────────────────────────────────────────

describe('E2E AI — benchmark report', () => {
  it('generates ai-format-report.md with token savings for all fixtures', () => {
    const fixtures = [
      '01-consumer-targeting',
      '02-prompt-instructions',
      '03-context-budget',
      '04-concepts-and-constraints',
      '05-format-benchmark',
    ]

    const rows: Array<{ name: string; std: number; ai: number; saved: number; pct: number }> = []

    for (const name of fixtures) {
      const stdResult = runRender(fixture(`${name}.md`), { cwd: ROOT, format: 'standard' })
      const aiResult = runRender(fixture(`${name}.md`), { cwd: ROOT, format: 'ai' })
      const stdTokens = estimateTokens(stdResult.output)
      const aiTokens = estimateTokens(aiResult.output)
      const saved = stdTokens - aiTokens
      const pct = stdTokens > 0 ? Math.round((saved / stdTokens) * 100) : 0
      rows.push({ name, std: stdTokens, ai: aiTokens, saved, pct })
    }

    const totalStd = rows.reduce((s, r) => s + r.std, 0)
    const totalAi = rows.reduce((s, r) => s + r.ai, 0)
    const totalSaved = totalStd - totalAi
    const totalPct = totalStd > 0 ? Math.round((totalSaved / totalStd) * 100) : 0

    const tableRows = rows.map(r =>
      `| ${r.name} | ${r.std} | ${r.ai} | ${r.saved} | ${r.pct}% |`
    ).join('\n')

    const report = [
      '# AI Format Benchmark Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Token Savings Summary',
      '',
      '| Fixture | Standard (est. tokens) | AI Format (est. tokens) | Saved | % |',
      '|---------|----------------------|------------------------|-------|---|',
      tableRows,
      `| **Total** | **${totalStd}** | **${totalAi}** | **${totalSaved}** | **${totalPct}%** |`,
      '',
      '## Notes',
      '- Token estimate: ceil(characters / 4)',
      '- AI format removes: horizontal rules, excess blank lines, decorative bold labels',
      '- AI format preserves: headings, code blocks, tables, links, lists, blockquotes',
    ].join('\n')

    writeFileSync(join(BENCHMARKS, 'ai-format-report.md'), report, 'utf8')

    // At least some savings across the full suite
    expect(totalSaved).toBeGreaterThan(0)
    expect(totalAi).toBeLessThan(totalStd)
  })
})
