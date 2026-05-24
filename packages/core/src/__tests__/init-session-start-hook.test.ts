import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { SESSION_START_HOOK_SCRIPT } from '../commands/init.js'

/**
 * SessionStart hook invariants:
 *   - When <cwd>/CLAUDE-MarkdownAI.md exists, the hook spawns `mai render`
 *     and emits a `hookSpecificOutput.additionalContext` JSON envelope on
 *     stdout with the rendered content inside.
 *   - When the file doesn't exist, the hook exits 0 silently (no stdout).
 *   - When `mai` is unavailable or render fails, the hook writes a warning
 *     to stderr but still exits 0 (never blocks session start).
 *   - The hook never modifies CLAUDE.md or any other file on disk.
 *
 * To make these tests deterministic across environments (CI without `mai`
 * on PATH, etc.) the spawn tests use a stub `mai` script we drop into a
 * tmp dir and prepend to PATH.
 */

describe('SessionStart hook (renders CLAUDE-MarkdownAI.md, injects additionalContext)', () => {
  let projectDir: string
  let hookPath: string
  let stubBinDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-ss-'))
    hookPath = join(projectDir, 'sessionStart.mjs')
    writeFileSync(hookPath, SESSION_START_HOOK_SCRIPT, 'utf8')

    // Stub `mai` script. Default: echo "RENDERED:<filepath>" and exit 0.
    // Individual tests overwrite this for failure-mode coverage.
    stubBinDir = join(projectDir, 'stub-bin')
    mkdirSync(stubBinDir, { recursive: true })
    writeFileSync(join(stubBinDir, 'mai'),
      '#!/bin/sh\necho "RENDERED:$2"\n',
      'utf8',
    )
    chmodSync(join(stubBinDir, 'mai'), 0o755)
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function runHook(stdinJson: object, opts: { withStub?: boolean } = {}): { code: number; stderr: string; stdout: string } {
    const env = { ...process.env }
    if (opts.withStub !== false) {
      env.PATH = `${stubBinDir}:${env.PATH ?? ''}`
    } else {
      // Force `mai` to be unfindable but keep node accessible. The hook
      // script runs under whatever PATH the child sees; we use the
      // absolute path to node (process.execPath) to invoke it so node
      // itself doesn't depend on PATH lookup.
      const emptyDir = join(projectDir, 'empty-bin')
      mkdirSync(emptyDir, { recursive: true })
      env.PATH = emptyDir
    }
    const proc = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
      env,
    })
    return {
      code: proc.status ?? -1,
      stderr: proc.stderr ?? '',
      stdout: proc.stdout ?? '',
    }
  }

  it('exits 0 silently when CLAUDE-MarkdownAI.md does not exist', () => {
    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stdout).toBe('')
    expect(out.stderr).toBe('')
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(false)
    expect(existsSync(join(projectDir, 'CLAUDE-MarkdownAI.md'))).toBe(false)
  })

  it('does NOT touch CLAUDE.md when CLAUDE-MarkdownAI.md is present', () => {
    const claudeMd = '# My project rules\n\nDo not touch this file.\n'
    writeFileSync(join(projectDir, 'CLAUDE.md'), claudeMd, 'utf8')
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\nhello\n', 'utf8')

    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    // CLAUDE.md byte-for-byte unchanged
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(claudeMd)
    // No backup files created either - zero writes outside the hook itself
    expect(existsSync(join(projectDir, 'CLAUDE.mai'))).toBe(false)
    expect(existsSync(join(projectDir, 'CLAUDE.md.mai'))).toBe(false)
  })

  it('emits hookSpecificOutput JSON with the rendered content on stdout', () => {
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\nhello\n', 'utf8')

    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stdout).not.toBe('')
    const parsed = JSON.parse(out.stdout)
    expect(parsed.hookSpecificOutput.hookEventName).toBe('SessionStart')
    expect(typeof parsed.hookSpecificOutput.additionalContext).toBe('string')
    // The stub mai echoes "RENDERED:<filepath>"
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/^RENDERED:.+CLAUDE-MarkdownAI\.md/)
  })

  it('exits 0 silently when render output is empty (nothing to inject)', () => {
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\n', 'utf8')
    // Overwrite the stub to emit empty stdout
    writeFileSync(join(stubBinDir, 'mai'), '#!/bin/sh\nexit 0\n', 'utf8')
    chmodSync(join(stubBinDir, 'mai'), 0o755)

    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stdout).toBe('')
  })

  it('warns to stderr and exits 0 when mai render fails (non-zero exit)', () => {
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\n@unclosed\n', 'utf8')
    // Overwrite the stub to fail
    writeFileSync(join(stubBinDir, 'mai'),
      '#!/bin/sh\necho "render error: unclosed block" >&2\nexit 1\n',
      'utf8',
    )
    chmodSync(join(stubBinDir, 'mai'), 0o755)

    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stdout).toBe('')
    expect(out.stderr).toMatch(/mai render failed/)
    expect(out.stderr).toMatch(/render error: unclosed block/)
  })

  it('warns to stderr and exits 0 when mai is not on PATH', () => {
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\nhello\n', 'utf8')

    const out = runHook({ cwd: projectDir }, { withStub: false })
    expect(out.code).toBe(0)
    expect(out.stdout).toBe('')
    expect(out.stderr).toMatch(/cannot invoke "mai render"/)
    expect(out.stderr).toMatch(/ENOENT/)
  })

  it('falls back to process.cwd() when stdin cwd is missing', () => {
    // No CLAUDE-MarkdownAI.md in process.cwd() (we're running from the workspace
    // root in tests), so hook should silently exit 0 with no output.
    const out = runHook({})
    expect(out.code).toBe(0)
    expect(out.stdout).toBe('')
  })

  it('never blocks session start - exits 0 even on malformed stdin', () => {
    const proc = spawnSync(process.execPath, [hookPath], {
      input: 'not-valid-json',
      encoding: 'utf8',
    })
    expect(proc.status).toBe(0)
  })

  it('handles cwd that does not exist (no crash, exit 0)', () => {
    const out = runHook({ cwd: '/this/path/does/not/exist/xyz' })
    expect(out.code).toBe(0)
    expect(out.stdout).toBe('')
  })

  it('preserves all stdout bytes from the renderer (multi-line, unicode)', () => {
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\n', 'utf8')
    // Use the literal ✓ char in the JS string. Writing it to a file with
    // utf8 encoding emits the correct 3-byte UTF-8 sequence.
    writeFileSync(join(stubBinDir, 'mai'),
      '#!/bin/sh\nprintf "Line 1\\nLine 2: ✓\\nLine 3\\n"\n',
      'utf8',
    )
    chmodSync(join(stubBinDir, 'mai'), 0o755)

    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    const parsed = JSON.parse(out.stdout)
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Line 1')
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Line 2: ✓')
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Line 3')
  })

  it('emits valid JSON even when rendered content has quotes/backslashes/newlines', () => {
    writeFileSync(join(projectDir, 'CLAUDE-MarkdownAI.md'), '@markdownai v1.0\n', 'utf8')
    writeFileSync(join(stubBinDir, 'mai'),
      '#!/bin/sh\nprintf \'He said "hi"\\nPath: C:\\\\Users\\\\test\\n\'\n',
      'utf8',
    )
    chmodSync(join(stubBinDir, 'mai'), 0o755)

    const out = runHook({ cwd: projectDir })
    expect(out.code).toBe(0)
    // Must parse cleanly - tests JSON.stringify is doing its job
    const parsed = JSON.parse(out.stdout)
    expect(parsed.hookSpecificOutput.additionalContext).toContain('"hi"')
    expect(parsed.hookSpecificOutput.additionalContext).toContain('\\Users\\test')
  })
})
