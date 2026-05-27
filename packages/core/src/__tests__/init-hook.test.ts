import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
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

  it('detects a directive line ANYWHERE in the document (stricter rule)', () => {
    // Updated 2026-05-25: the rule is now "any @-directive line, anywhere".
    // A file that mentions @markdownai mid-document still contains directive
    // syntax that Claude must not see raw. The engine must render it.
    const content = [
      '# Some other doc',
      '',
      'Some prose.',
      '',
      '@markdownai v1.0',
    ].join('\n')
    expect(isMarkdownAIDocument(content)).toBe(true)
  })

  it('rejects a file with frontmatter but no directive lines anywhere', () => {
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

  it('detects directives even inside an unclosed frontmatter block', () => {
    // The new rule does not depend on frontmatter parsing — any line that
    // begins with @ + identifier triggers blocking, malformed YAML or not.
    const content = [
      '---',
      'title: Hello',
      '',
      '@markdownai v1.0',
    ].join('\n')
    expect(isMarkdownAIDocument(content)).toBe(true)
  })

  it('detects any markdownai directive (@phase, @if, @call, @plugin-meta, etc.)', () => {
    expect(isMarkdownAIDocument('# Doc\n@phase setup\n')).toBe(true)
    expect(isMarkdownAIDocument('# Doc\n@if {{ x }}\n')).toBe(true)
    expect(isMarkdownAIDocument('# Doc\n@call my-macro\n')).toBe(true)
    expect(isMarkdownAIDocument('# Doc\n@plugin-meta\n')).toBe(true)
    expect(isMarkdownAIDocument('# Doc\n@markdownai-detect\n')).toBe(true)
  })

  it('does NOT flag JSDoc-style annotations (leading asterisk before @)', () => {
    // JSDoc comment lines like " * @param foo" start with a space-asterisk-
    // space-@. The regex requires the @ to be the first non-whitespace
    // character on the line, so JSDoc inside Markdown code blocks is fine.
    const content = [
      '# API doc',
      '',
      '```js',
      '/**',
      ' * @param {string} name',
      ' * @returns {Promise}',
      ' */',
      'function foo(name) {}',
      '```',
    ].join('\n')
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

  it('opens with ironclad imperative framing', () => {
    expect(REDIRECT_MESSAGE).toContain('STOP. I CANNOT read this file')
    expect(REDIRECT_MESSAGE).toContain('I MUST forward it to the MarkdownAI MCP server')
  })

  it('explains why direct Read is blocked', () => {
    expect(REDIRECT_MESSAGE).toContain('unexecuted directives')
    expect(REDIRECT_MESSAGE).toContain('FORBIDDEN')
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
  let systemDir: string                  // path that mimics a system root (~/.claude/mdd2/...)
  let hookPath: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-hook-proj-'))
    hookPath = join(projectDir, 'hook.mjs')
    // The hook scopes its block to SYSTEM-installed paths (under ~/.claude/mdd2,
    // ~/.markdownai, etc.). Create a fake system-shaped subdirectory inside HOME
    // so the hook's SYSTEM_ROOTS check matches; tests then write a file there
    // and expect it to be blocked. The path is unique per test run; we clean
    // it up in afterEach so the user's real ~/.claude/mdd2 is not polluted.
    systemDir = join(process.env['HOME'] ?? tmpdir(), '.claude', 'mdd2', `__hook_test_${process.pid}_${Date.now()}`)
    rmSync(systemDir, { recursive: true, force: true })
    writeFileSync(hookPath, HOOK_SCRIPT, 'utf8')
    mkdirSync(systemDir, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
    try { rmSync(systemDir, { recursive: true, force: true }) } catch { /* ignore */ }
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

  it('blocks Read on a bare-@markdownai file in a system path with exit 2 and the redirect message', () => {
    // Updated 2026-05-25: the hook only blocks .md files in SYSTEM-installed
    // paths (~/.claude/mdd2, ~/.markdownai, etc.). Project source files
    // remain readable so authors (and Claude) can edit them.
    const docPath = join(systemDir, 'doc.md')
    writeFileSync(docPath, '@markdownai v1.0\n\n# Hello\n', 'utf8')
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: docPath },
    })
    expect(out.code).toBe(2)
    expect(out.stderr).toContain('mcp__markdownai__resolve_phase')
    expect(out.stderr).toContain('PRIMARY TOOL')
  })

  it('blocks Read on a YAML-frontmatter @markdownai file in a system path', () => {
    const docPath = join(systemDir, 'mdd.md')
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

  it('allows Read on @markdownai files in a PROJECT (non-system) path', () => {
    // Project source files where the user is authoring — Claude needs raw
    // source to help edit them, so the hook lets these through.
    const docPath = join(projectDir, 'doc.md')
    writeFileSync(docPath, '@markdownai v1.0\n\n# Hello\n', 'utf8')
    const out = runHookWith({
      tool_name: 'Read',
      tool_input: { file_path: docPath },
    })
    expect(out.code).toBe(0)
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

  it('handles read_file tool name (MCP-style payload) the same as Read for system paths', () => {
    const docPath = join(systemDir, 'doc.md')
    writeFileSync(docPath, '@markdownai v1.0\n', 'utf8')
    const out = runHookWith({
      tool_name: 'read_file',
      tool_input: { path: docPath },
    })
    expect(out.code).toBe(2)
    expect(out.stderr).toContain('mcp__markdownai__resolve_phase')
  })
})
