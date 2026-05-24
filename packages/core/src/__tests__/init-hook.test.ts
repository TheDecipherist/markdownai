import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { isMarkdownAIDocument, REDIRECT_MESSAGE, HOOK_SCRIPT } from '../commands/init.js'

describe('isMarkdownAIDocument', () => {
  it('detects bare @markdownai header on first line', () => {
    expect(isMarkdownAIDocument('@markdownai v1.0\nbody\n')).toBe(true)
  })

  it('detects @markdownai after leading blank lines', () => {
    expect(isMarkdownAIDocument('\n\n@markdownai v1.0\nbody\n')).toBe(true)
  })

  it('detects @markdownai after YAML frontmatter (Claude Code slash-command shape)', () => {
    const content = [
      '---',
      'description: "MDD workflow"',
      'mdd_version: 12',
      '---',
      '@markdownai v1.0',
      '@import ./mdd-shared.md',
      '',
      '# /mdd',
    ].join('\n')
    expect(isMarkdownAIDocument(content)).toBe(true)
  })

  it('detects @markdownai after frontmatter with blank line padding', () => {
    const content = [
      '---',
      'description: x',
      '---',
      '',
      '',
      '@markdownai v1.0',
    ].join('\n')
    expect(isMarkdownAIDocument(content)).toBe(true)
  })

  it('rejects a plain Markdown file with no @markdownai', () => {
    expect(isMarkdownAIDocument('# Just a regular doc\n\nNothing special.\n')).toBe(false)
  })

  it('rejects a file with @markdownai mentioned mid-document but not at the top', () => {
    const content = [
      '# Some other doc',
      '',
      'This doc mentions @markdownai in prose but does not start with it.',
      '',
      '@markdownai v1.0',
    ].join('\n')
    expect(isMarkdownAIDocument(content)).toBe(false)
  })

  it('rejects a file with frontmatter but the post-frontmatter content is regular Markdown', () => {
    const content = [
      '---',
      'title: Hello',
      '---',
      '# Hello',
      '',
      'Not a MarkdownAI doc.',
    ].join('\n')
    expect(isMarkdownAIDocument(content)).toBe(false)
  })

  it('rejects a file with an unclosed frontmatter block', () => {
    const content = [
      '---',
      'title: Hello',
      '',
      '@markdownai v1.0',
    ].join('\n')
    // No closing `---` - this is malformed; reject conservatively.
    expect(isMarkdownAIDocument(content)).toBe(false)
  })

  it('rejects an empty file', () => {
    expect(isMarkdownAIDocument('')).toBe(false)
    expect(isMarkdownAIDocument('\n\n\n')).toBe(false)
  })
})

describe('REDIRECT_MESSAGE', () => {
  it('lists every MCP tool by its namespaced name', () => {
    const required = [
      'mcp__markdownai__list_phases',
      'mcp__markdownai__resolve_phase',
      'mcp__markdownai__next_phase',
      'mcp__markdownai__read_file',
      'mcp__markdownai__execute_directive',
      'mcp__markdownai__call_macro',
      'mcp__markdownai__get_constraints',
      'mcp__markdownai__get_env',
      'mcp__markdownai__invalidate_cache',
    ]
    for (const name of required) {
      expect(REDIRECT_MESSAGE).toContain(name)
    }
  })

  it('marks resolve_phase as the primary tool', () => {
    expect(REDIRECT_MESSAGE).toContain('PRIMARY TOOL')
    expect(REDIRECT_MESSAGE).toMatch(/resolve_phase[\s\S]*PRIMARY TOOL/)
  })

  it('explains why direct Read is blocked', () => {
    expect(REDIRECT_MESSAGE).toContain('unrendered directive syntax')
  })

  it('includes a typical workflow with numbered steps', () => {
    expect(REDIRECT_MESSAGE).toContain('TYPICAL WORKFLOW')
    expect(REDIRECT_MESSAGE).toContain('Step 1')
    expect(REDIRECT_MESSAGE).toContain('Step 5')
  })

  it('tells Claude not to retry the Read', () => {
    expect(REDIRECT_MESSAGE).toMatch(/DO NOT retry/)
  })
})

/**
 * Integration tests: install the hook into a temp settings dir, then run
 * the generated .mjs with a simulated Claude Code PreToolUse JSON payload
 * on stdin. Assert exit code + stderr.
 */
describe('PreToolUse hook (end-to-end via spawn)', () => {
  let projectDir: string
  let hookPath: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-hook-proj-'))
    hookPath = join(projectDir, 'hook.mjs')
    // Write the bundled hook source directly to a temp file. No reliance on
    // ~/.markdownai - tests are fully isolated.
    writeFileSync(hookPath, HOOK_SCRIPT, 'utf8')
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function runHookWith(stdinJson: object): { code: number; stderr: string; stdout: string } {
    const proc = spawnSync('node', [hookPath], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
    })
    return {
      code: proc.status ?? -1,
      stderr: proc.stderr ?? '',
      stdout: proc.stdout ?? '',
    }
  }

  it('blocks Read on a bare-@markdownai file with exit 2 and the redirect message', () => {
    const docPath = join(projectDir, 'doc.md')
    writeFileSync(docPath, '@markdownai v1.0\n\n# Hello\n', 'utf8')
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: docPath },
    })
    expect(out.code).toBe(2)
    expect(out.stderr).toContain('mcp__markdownai__resolve_phase')
    expect(out.stderr).toContain('PRIMARY TOOL')
  })

  it('blocks Read on a file with YAML frontmatter then @markdownai', () => {
    const docPath = join(projectDir, 'mdd.md')
    writeFileSync(docPath, [
      '---',
      'description: "MDD"',
      'mdd_version: 12',
      '---',
      '@markdownai v1.0',
      '@import ./mdd-shared.md',
      '',
      '# /mdd',
    ].join('\n'), 'utf8')
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: docPath },
    })
    expect(out.code).toBe(2)
    expect(out.stderr).toContain('mcp__markdownai__resolve_phase')
  })

  it('allows Read on a plain Markdown file (no @markdownai header)', () => {
    const docPath = join(projectDir, 'readme.md')
    writeFileSync(docPath, '# Just a README\n\nPlain Markdown.\n', 'utf8')
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: docPath },
    })
    expect(out.code).toBe(0)
    expect(out.stderr).toBe('')
  })

  it('allows non-Read tools (e.g. Edit) to pass through even on MarkdownAI files', () => {
    const docPath = join(projectDir, 'doc.md')
    writeFileSync(docPath, '@markdownai v1.0\n\n# Hello\n', 'utf8')
    const out = runHookWith({
      tool_name: 'Edit',
      tool_input: { file_path: docPath },
    })
    expect(out.code).toBe(0)
  })

  it('allows reads of non-.md files', () => {
    const codePath = join(projectDir, 'thing.ts')
    writeFileSync(codePath, 'export const x = 1;\n', 'utf8')
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: codePath },
    })
    expect(out.code).toBe(0)
  })

  it('handles missing tool_input gracefully (exits 0)', () => {
    const out = runHookWith({ tool_name: 'Read' })
    expect(out.code).toBe(0)
  })

  it('handles missing file gracefully (exits 0)', () => {
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: join(projectDir, 'does-not-exist.md') },
    })
    expect(out.code).toBe(0)
  })

  it('handles read_file tool name (MCP-style payload) the same as Read', () => {
    const docPath = join(projectDir, 'doc.md')
    writeFileSync(docPath, '@markdownai v1.0\n', 'utf8')
    const out = runHookWith({
      tool_name: 'read_file',
      tool_input: { path: docPath },
    })
    expect(out.code).toBe(2)
    expect(out.stderr).toContain('mcp__markdownai__resolve_phase')
  })
})
