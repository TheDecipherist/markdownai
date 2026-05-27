import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRender } from '../commands/render.js'

const TMP = join(tmpdir(), 'markdownai-note-test')

beforeAll(() => { mkdirSync(TMP, { recursive: true }) })
afterAll(() => { rmSync(TMP, { recursive: true, force: true }) })

function write(name: string, content: string): string {
  const p = join(TMP, name)
  writeFileSync(p, content)
  return p
}

// --- Default behaviour: stripped ---

describe('@note — default (stripped)', () => {
  it('produces no output when @note has no arguments', () => {
    const file = write('note-stripped.md',
      '@markdownai\n\n@note\nThis is a source comment.\n@note-end\n\n# After\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).not.toContain('source comment')
    expect(result.output).toContain('# After')
  })

  it('does not emit the @note or @end lines', () => {
    const file = write('note-no-lines.md',
      '@markdownai\n\n@note\nHidden body.\n@note-end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toBe('')
  })

  it('surrounding content is unaffected', () => {
    const file = write('note-surrounding.md',
      '@markdownai\n\n# Before\n\n@note\nHidden.\n@note-end\n\n# After\n')
    const result = runRender(file)
    expect(result.output).toContain('# Before')
    expect(result.output).toContain('# After')
    expect(result.output).not.toContain('Hidden')
  })

  it('consumer= without visible is silently ignored — still strips', () => {
    const file = write('note-consumer-no-visible.md',
      '@markdownai\n\n@note consumer="human"\nShould still strip.\n@note-end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).not.toContain('Should still strip')
  })
})

// --- visible: renders to all consumers ---

describe('@note visible — renders to all consumers', () => {
  it('renders body as blockquote with Note: label', () => {
    const file = write('note-visible.md',
      '@markdownai\n\n@note visible\nThis is visible.\n@note-end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('**Note:**')
    expect(result.output).toContain('This is visible.')
    expect(result.output).toContain('>')
  })

  it('renders multi-line body with each line prefixed by >', () => {
    const file = write('note-visible-multiline.md',
      '@markdownai\n\n@note visible\nLine one.\nLine two.\n@note-end\n')
    const result = runRender(file)
    const lines = result.output.split('\n').filter(l => l.trim())
    const bodyLines = lines.filter(l => l.startsWith('>') && !l.includes('**Note:**'))
    expect(bodyLines.length).toBeGreaterThanOrEqual(2)
  })

  it('does not include @note or @end in output', () => {
    const file = write('note-visible-no-syntax.md',
      '@markdownai\n\n@note visible\nContent.\n@note-end\n')
    const result = runRender(file)
    expect(result.output).not.toContain('@note')
    expect(result.output).not.toContain('@end')
  })
})

// --- visible consumer="human" ---

describe('@note visible consumer="human"', () => {
  it('renders as blockquote when consumer is human (default)', () => {
    const file = write('note-human.md',
      '@markdownai\n\n@note visible consumer="human"\nFor humans only.\n@note-end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('**Note:**')
    expect(result.output).toContain('For humans only.')
    expect(result.output).toMatch(/^>/m)
  })

  it('strips when consumer is ai', () => {
    const file = write('note-human-ai-consumer.md',
      '@markdownai\n\n@note visible consumer="human"\nFor humans only.\n@note-end\n')
    const result = runRender(file, { consumer: 'ai' })
    expect(result.exitCode).toBe(0)
    expect(result.output).not.toContain('For humans only.')
  })
})

// --- visible consumer="ai" ---

describe('@note visible consumer="ai"', () => {
  it('renders as blockquote when consumer is ai', () => {
    const file = write('note-ai.md',
      '@markdownai\n\n@note visible consumer="ai"\nFor AI only.\n@note-end\n')
    const result = runRender(file, { consumer: 'ai' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('**Note:**')
    expect(result.output).toContain('For AI only.')
    expect(result.output).toMatch(/^>/m)
  })

  it('strips when consumer is human (default)', () => {
    const file = write('note-ai-human-consumer.md',
      '@markdownai\n\n@note visible consumer="ai"\nFor AI only.\n@note-end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).not.toContain('For AI only.')
  })
})

// --- Inside @define macros ---

describe('@note inside @define macros', () => {
  it('strips @note when expanded via @call', () => {
    const file = write('note-in-macro.md',
      '@markdownai\n\n@define greet\n@note\nThis is a macro note.\n@note-end\nHello!\n@define-end\n\n@call greet /\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Hello!')
    expect(result.output).not.toContain('macro note')
  })

  it('renders visible @note when expanded via @call', () => {
    const file = write('note-visible-in-macro.md',
      '@markdownai\n\n@define greet\n@note visible\nVisible macro note.\n@note-end\nHello!\n@define-end\n\n@call greet /\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Hello!')
    expect(result.output).toContain('Visible macro note.')
  })
})

// --- Nested @note ---

describe('@note nesting', () => {
  it('renders nested @note blocks without error (v2 parser tracks depth)', () => {
    const file = write('note-nested.md',
      '@markdownai\n\n@note\nOuter.\n@note\nInner.\n@note-end\n@note-end\n')
    const result = runRender(file)
    expect(result.errors).toEqual([])
  })
})
