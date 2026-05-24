import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listPhases } from '../tools/list_phases.js'
import { resolvePhase } from '../tools/resolve_phase.js'
import { nextPhase } from '../tools/next_phase.js'

/**
 * MCP phase rendering invariants:
 *
 *   1. The MCP server runs every directive in a phase body. Claude never
 *      executes directives.
 *   2. The rendered content returned by resolve_phase contains ZERO
 *      @directive syntax. Every directive substitutes its result inline.
 *   3. Errors from directives appear in `warnings` or in the rendered
 *      content (where the directive sat), not silently dropped.
 *   4. Phase isolation works: resolve_phase returns only the body of the
 *      named phase.
 *
 * Note on directive placement: the MarkdownAI parser only recognizes a
 * directive when `@` is the FIRST non-whitespace character on its line.
 * To interpolate a directive's output mid-prose, use `label=foo` on the
 * directive (on its own line) then `{{ foo }}` in the prose.
 */

describe('MCP phase rendering invariants', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mai-mcp-phase-'))
  })

  afterEach(() => {
    try { rmSync(tmp, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  describe('list_phases', () => {
    it('returns every @phase name in the file', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase 0-intro',
        'Intro body.',
        '@end',
        '@phase 1-questions',
        'Questions body.',
        '@end',
        '@phase 2-final',
        'Final body.',
        '@end',
      ].join('\n'), 'utf8')

      const r = listPhases('doc.md', tmp)
      expect(r.error).toBeUndefined()
      expect(r.phases.map(p => p.name)).toEqual(['0-intro', '1-questions', '2-final'])
    })

    it('returns transitions per phase', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase a',
        'Body.',
        '@on complete -> @phase b',
        '@end',
        '@phase b',
        'Body.',
        '@end',
      ].join('\n'), 'utf8')

      const r = listPhases('doc.md', tmp)
      expect(r.phases[0]?.transitions.length).toBe(1)
      expect(r.phases[0]?.transitions[0]?.action.name).toBe('b')
    })
  })

  describe('resolve_phase fires directives and substitutes results', () => {
    it('@date fires and {{ label }} substitutes the result inline', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase show-date',
        '@date format="YYYY-MM-DD" label=today',
        'Today is {{ today }}.',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'show-date', tmp)
      expect(r.found).toBe(true)
      expect(r.content).toMatch(/Today is 20\d\d-\d\d-\d\d\./)
      expect(r.content).not.toContain('@date')
      expect(r.content).not.toContain('{{ today }}')
    })

    it('@count fires and interpolates the count', () => {
      mkdirSync(join(tmp, 'data'), { recursive: true })
      writeFileSync(join(tmp, 'data/a.md'), 'x', 'utf8')
      writeFileSync(join(tmp, 'data/b.md'), 'x', 'utf8')
      writeFileSync(join(tmp, 'data/c.md'), 'x', 'utf8')
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase count-files',
        '@count ./data/ match="*.md" type=files label=n',
        'There are {{ n }} docs.',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'count-files', tmp)
      expect(r.content).toContain('There are 3 docs.')
      expect(r.content).not.toContain('@count')
    })

    it('@read-frontmatter fires and the field value substitutes', () => {
      writeFileSync(join(tmp, 'target.md'), '---\nstatus: complete\n---\nbody\n', 'utf8')
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase show-status',
        '@read-frontmatter path="target.md" field="status" label=s',
        'Status: {{ s }}',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'show-status', tmp)
      expect(r.content).toContain('Status: complete')
      expect(r.content).not.toContain('@read-frontmatter')
    })

    it('@if collapses to only the matching branch', () => {
      writeFileSync(join(tmp, 'exists.md'), 'x', 'utf8')
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase branch',
        '@if file.isFile("exists.md")',
        'TRUE_BRANCH',
        '@else',
        'FALSE_BRANCH',
        '@endif',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'branch', tmp)
      expect(r.content).toContain('TRUE_BRANCH')
      expect(r.content).not.toContain('FALSE_BRANCH')
      expect(r.content).not.toContain('@if')
      expect(r.content).not.toContain('@else')
      expect(r.content).not.toContain('@endif')
    })

    it('@foreach unrolls the body per item with no @foreach syntax in the output', () => {
      mkdirSync(join(tmp, 'docs'), { recursive: true })
      writeFileSync(join(tmp, 'docs/01.md'), '---\nid: 01\n---\n', 'utf8')
      writeFileSync(join(tmp, 'docs/02.md'), '---\nid: 02\n---\n', 'utf8')
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase loop',
        '@foreach f in @list ./docs/ match="*.md"',
        '- {{ f }}',
        '@end',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'loop', tmp)
      expect(r.content).toContain('docs/01.md')
      expect(r.content).toContain('docs/02.md')
      expect(r.content).not.toContain('@foreach')
      expect(r.content).not.toContain('{{ f }}')
    })

    it('@set binds a value and {{ var }} interpolates it', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase set-demo',
        '@set name = "Alice"',
        'Hello, {{ name }}.',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'set-demo', tmp)
      expect(r.content).toContain('Hello, Alice.')
      expect(r.content).not.toContain('@set')
      expect(r.content).not.toContain('{{ name }}')
    })

    it('@call fires a macro defined in the same document', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@define greet',
        'Hi from the macro.',
        '@end',
        '@phase use-macro',
        '@call greet',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'use-macro', tmp)
      expect(r.content).toContain('Hi from the macro.')
      expect(r.content).not.toContain('@call')
      expect(r.content).not.toContain('@define')
    })

    it('mixed directives all fire in one phase render', () => {
      writeFileSync(join(tmp, 'target.md'), '---\nfeat: foo\n---\n', 'utf8')
      mkdirSync(join(tmp, 'src'), { recursive: true })
      writeFileSync(join(tmp, 'src/a.ts'), '', 'utf8')
      writeFileSync(join(tmp, 'src/b.ts'), '', 'utf8')
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase mixed',
        '@count ./src/ match="*.ts" label=n',
        '@read-frontmatter path="target.md" field="feat" label=f',
        'Feature {{ f }} has {{ n }} source files.',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'mixed', tmp)
      expect(r.content).toContain('Feature foo has 2 source files.')
      expect(r.content).not.toContain('@count')
      expect(r.content).not.toContain('@read-frontmatter')
      expect(r.content).not.toContain('{{ f }}')
      expect(r.content).not.toContain('{{ n }}')
    })
  })

  describe('phase isolation', () => {
    it('returns only the matching phase body, never another phase content', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase one',
        'CONTENT_OF_ONE',
        '@end',
        '@phase two',
        'CONTENT_OF_TWO',
        '@end',
        '@phase three',
        'CONTENT_OF_THREE',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'two', tmp)
      expect(r.content).toContain('CONTENT_OF_TWO')
      expect(r.content).not.toContain('CONTENT_OF_ONE')
      expect(r.content).not.toContain('CONTENT_OF_THREE')
    })

    it('found=false for a non-existent phase', () => {
      writeFileSync(join(tmp, 'doc.md'), '@markdownai v1.0\n@phase a\nx\n@end\n', 'utf8')
      const r = resolvePhase('doc.md', 'nonexistent', tmp)
      expect(r.found).toBe(false)
    })
  })

  describe('the zero-directive-syntax invariant', () => {
    it('rendered content never contains directive markers for ANY directive used', () => {
      // A maximalist phase. The output must not contain `@foo` for any of
      // the directives below, and the actual data must be present.
      mkdirSync(join(tmp, 'docs'), { recursive: true })
      writeFileSync(join(tmp, 'docs/x.md'), '---\nstatus: ok\n---\n', 'utf8')
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase max',
        '@date format="YYYY-MM-DD" label=today',
        '@count ./docs/ match="*.md" label=n',
        '@set greeting = "hello"',
        '@if {{ n }} > "0"',
        '@foreach f in @list ./docs/ match="*.md"',
        '@read-frontmatter path="{{ f }}" field="status" label=s',
        '- {{ f }} ({{ s }})',
        '@end',
        '@endif',
        '@end',
      ].join('\n'), 'utf8')

      const r = resolvePhase('doc.md', 'max', tmp)
      const directiveTokens = [
        '@date', '@count', '@set', '@if', '@else', '@elseif', '@endif',
        '@foreach', '@read-frontmatter', '@list',
      ]
      for (const tok of directiveTokens) {
        expect(r.content, `directive token "${tok}" leaked into rendered output`).not.toContain(tok)
      }
      // The actual data should be there.
      expect(r.content).toContain('docs/x.md (ok)')
    })
  })

  describe('next_phase transitions', () => {
    it('follows @on complete -> @phase <next>', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase a',
        'A body.',
        '@on complete -> @phase b',
        '@end',
        '@phase b',
        'B body.',
        '@end',
      ].join('\n'), 'utf8')

      const r = nextPhase('doc.md', 'a', tmp)
      expect(r.found).toBe(true)
      expect(r.phase).toBe('b')
    })

    it('returns phase=null when no transition is declared', () => {
      writeFileSync(join(tmp, 'doc.md'), [
        '@markdownai v1.0',
        '@phase a',
        'A body.',
        '@end',
      ].join('\n'), 'utf8')

      const r = nextPhase('doc.md', 'a', tmp)
      expect(r.phase).toBeNull()
    })
  })
})
