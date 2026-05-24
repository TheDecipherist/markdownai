import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  SESSION_START_HOOK_SCRIPT,
  SESSION_END_HOOK_SCRIPT,
  CLAUDE_MD_ALLOWED_DIRECTIVES,
  CLAUDE_MD_REFUSED_DIRECTIVES,
  findRefusedClaudeMdDirectives,
  buildSessionStartRefusalMessage,
} from '../commands/init.js'

describe('findRefusedClaudeMdDirectives', () => {
  it('detects @phase at line start', () => {
    expect(findRefusedClaudeMdDirectives('@phase intro\n@end\n')).toEqual(['@phase'])
  })

  it('detects @test at line start', () => {
    expect(findRefusedClaudeMdDirectives('@test command="pnpm test"\n')).toEqual(['@test'])
  })

  it('detects multiple refused directives in one document', () => {
    const source = [
      '@markdownai v1.0',
      '@phase a',
      '@test',
      '@end',
      '@http url="https://example.com"',
    ].join('\n')
    const refused = findRefusedClaudeMdDirectives(source)
    expect(refused).toContain('@phase')
    expect(refused).toContain('@test')
    expect(refused).toContain('@http')
  })

  it('detects write directives (@mkdir, @copy, @update-frontmatter, ...)', () => {
    const source = [
      '@mkdir .mdd',
      '@copy from=a.md to=b.md',
      '@update-frontmatter path="d.md" field="x" value="y"',
    ].join('\n')
    const refused = findRefusedClaudeMdDirectives(source)
    expect(refused).toContain('@mkdir')
    expect(refused).toContain('@copy')
    expect(refused).toContain('@update-frontmatter')
  })

  it('allows the safe set: @date, @count, @if, @foreach, @set, @call, @read', () => {
    const source = [
      '@markdownai v1.0',
      '@date format="YYYY-MM-DD" label=today',
      '@count ./.mdd/docs/ match="*.md" label=n',
      '@if {{ n }} > "0"',
      '@foreach doc in @list ./.mdd/docs/',
      '@read-frontmatter path="{{ doc }}" field="title"',
      '@end',
      '@endif',
      '@set greeting = "hi"',
      '@call git-branch',
    ].join('\n')
    expect(findRefusedClaudeMdDirectives(source)).toEqual([])
  })

  it('does NOT flag @phase mentioned mid-line in prose', () => {
    expect(findRefusedClaudeMdDirectives('This doc explains @phase semantics.\n')).toEqual([])
  })

  it('does NOT flag @test inside a code fence (parser treats fenced content as literal)', () => {
    const source = [
      'Example syntax:',
      '`@test command="..."`',
    ].join('\n')
    expect(findRefusedClaudeMdDirectives(source)).toEqual([])
  })

  it('returns empty for plain Markdown with no directives', () => {
    expect(findRefusedClaudeMdDirectives('# Hello\n\nPlain text.\n')).toEqual([])
  })
})

describe('CLAUDE_MD_REFUSED_DIRECTIVES catalogue', () => {
  it('includes every phase/transition construct', () => {
    expect(CLAUDE_MD_REFUSED_DIRECTIVES).toHaveProperty('@phase')
    expect(CLAUDE_MD_REFUSED_DIRECTIVES).toHaveProperty('@on')
  })

  it('includes every slow/async runner', () => {
    for (const d of ['@test', '@check', '@http', '@query', '@db']) {
      expect(CLAUDE_MD_REFUSED_DIRECTIVES).toHaveProperty(d)
    }
  })

  it('includes every filesystem-write directive', () => {
    for (const d of ['@mkdir', '@copy', '@append-if-missing', '@update-frontmatter', '@render-template']) {
      expect(CLAUDE_MD_REFUSED_DIRECTIVES).toHaveProperty(d)
    }
  })

  it('does not refuse any of the allowed directives', () => {
    for (const d of CLAUDE_MD_ALLOWED_DIRECTIVES) {
      expect(CLAUDE_MD_REFUSED_DIRECTIVES).not.toHaveProperty(d)
    }
  })
})

describe('buildSessionStartRefusalMessage', () => {
  it('lists each refused directive on its own line with its category description', () => {
    const msg = buildSessionStartRefusalMessage(['@phase', '@test'])
    expect(msg).toMatch(/@phase\s+-\s+phase \(lazy-load construct/)
    expect(msg).toMatch(/@test\s+-\s+test \(runs the project test suite/)
  })

  it('explains the three rules (instant, synchronous, read-only)', () => {
    const msg = buildSessionStartRefusalMessage(['@http'])
    expect(msg).toMatch(/instant/i)
    expect(msg).toMatch(/synchronous|MCP/)
    expect(msg).toMatch(/side-effect|writes/i)
  })

  it('lists the allowed-directives summary so the user knows what to use instead', () => {
    const msg = buildSessionStartRefusalMessage(['@phase'])
    expect(msg).toContain('@date')
    expect(msg).toContain('@count')
    expect(msg).toContain('@if')
    expect(msg).toContain('@foreach')
  })

  it('reassures the user the session will start normally', () => {
    const msg = buildSessionStartRefusalMessage(['@phase'])
    expect(msg).toMatch(/Session will start normally/)
    expect(msg).toMatch(/CLAUDE\.md left untouched/)
  })
})

describe('SessionStart hook (end-to-end via spawn)', () => {
  let projectDir: string
  let startHookPath: string
  let endHookPath: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-sshook-'))
    startHookPath = join(projectDir, 'sessionStart.mjs')
    endHookPath = join(projectDir, 'sessionEnd.mjs')
    writeFileSync(startHookPath, SESSION_START_HOOK_SCRIPT, 'utf8')
    writeFileSync(endHookPath, SESSION_END_HOOK_SCRIPT, 'utf8')
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function runStart(stdinJson: object): { code: number; stderr: string; stdout: string } {
    const proc = spawnSync('node', [startHookPath], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
    })
    return {
      code: proc.status ?? -1,
      stderr: proc.stderr ?? '',
      stdout: proc.stdout ?? '',
    }
  }

  function runEnd(stdinJson: object): { code: number; stderr: string; stdout: string } {
    const proc = spawnSync('node', [endHookPath], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
    })
    return {
      code: proc.status ?? -1,
      stderr: proc.stderr ?? '',
      stdout: proc.stdout ?? '',
    }
  }

  it('exits 0 silently when CLAUDE.md does not exist', () => {
    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toBe('')
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(false)
    expect(existsSync(join(projectDir, 'CLAUDE.mai'))).toBe(false)
  })

  it('exits 0 silently when CLAUDE.md is plain markdown (no @markdownai)', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), '# Plain Markdown\n\nNo directives here.\n', 'utf8')
    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toBe('')
    // CLAUDE.md unchanged, no backup created
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe('# Plain Markdown\n\nNo directives here.\n')
    expect(existsSync(join(projectDir, 'CLAUDE.mai'))).toBe(false)
  })

  it('backs up CLAUDE.md to CLAUDE.mai and renders CLAUDE.md in place when source has only allowed directives', () => {
    const source = [
      '@markdownai v1.0',
      '@date format="YYYY-MM-DD" label=today',
      '# Project Rules',
      '',
      'Today is {{ today }}.',
    ].join('\n')
    writeFileSync(join(projectDir, 'CLAUDE.md'), source, 'utf8')

    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)

    // Backup exists and contains original source with directives
    expect(existsSync(join(projectDir, 'CLAUDE.mai'))).toBe(true)
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe(source)

    // CLAUDE.md is now rendered output - no directive syntax left
    const rendered = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')
    expect(rendered).toMatch(/Today is 20\d\d-\d\d-\d\d\./)
    expect(rendered).toContain('# Project Rules')
    expect(rendered).not.toContain('@date')
    expect(rendered).not.toContain('{{ today }}')
  })

  it('refreshes CLAUDE.mai backup on every session start (latest source wins)', () => {
    // First session
    const v1 = '@markdownai v1.0\n@date format="YYYY-MM-DD" label=today\nv1 today {{ today }}\n'
    writeFileSync(join(projectDir, 'CLAUDE.md'), v1, 'utf8')
    runStart({ cwd: projectDir })
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe(v1)

    // Simulate SessionEnd restoring the source
    runEnd({ cwd: projectDir })
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(v1)

    // User edits CLAUDE.md (the source)
    const v2 = '@markdownai v1.0\n@date format="YYYY-MM-DD" label=today\nv2 today {{ today }}\n'
    writeFileSync(join(projectDir, 'CLAUDE.md'), v2, 'utf8')

    // Next session - backup must now match v2
    runStart({ cwd: projectDir })
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe(v2)
  })

  it('refuses to render when source uses @phase (and explains why) - both files preserved', () => {
    const source = '@markdownai v1.0\n@phase intro\nIntro content.\n@end\n'
    writeFileSync(join(projectDir, 'CLAUDE.md'), source, 'utf8')

    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)  // never blocks session start
    expect(out.stderr).toMatch(/refusing to render/i)
    expect(out.stderr).toContain('@phase')
    expect(out.stderr).toMatch(/lazy-load construct/)

    // CLAUDE.md MUST be left untouched - it still has the directives
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(source)
    // And no backup file created (refusal is pre-backup)
    expect(existsSync(join(projectDir, 'CLAUDE.mai'))).toBe(false)
  })

  it('refuses to render when source uses @test (slow / runs test runner)', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), '@markdownai v1.0\n@test command="pnpm test"\n', 'utf8')
    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toContain('@test')
    expect(out.stderr).toMatch(/runs the project test suite/)
  })

  it('refuses to render when source uses @mkdir (filesystem write)', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), '@markdownai v1.0\n@mkdir .mdd\n', 'utf8')
    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toContain('@mkdir')
    expect(out.stderr).toMatch(/filesystem write/)
  })

  it('lists multiple refused directives at once', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), [
      '@markdownai v1.0',
      '@phase a',
      '@test',
      '@http url="https://example.com"',
      '@end',
    ].join('\n'), 'utf8')

    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toContain('@phase')
    expect(out.stderr).toContain('@test')
    expect(out.stderr).toContain('@http')
  })

  it('crash-recovery: previous session ended dirty (CLAUDE.md is rendered, CLAUDE.mai is the source)', () => {
    // Simulate previous SessionStart finished but SessionEnd never fired
    const source = '@markdownai v1.0\n@date format="YYYY-MM-DD" label=t\nDate: {{ t }}\n'
    writeFileSync(join(projectDir, 'CLAUDE.mai'), source, 'utf8')
    writeFileSync(join(projectDir, 'CLAUDE.md'), 'Date: 2024-01-01\n', 'utf8')

    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toMatch(/recovered CLAUDE\.md from CLAUDE\.mai/)

    // CLAUDE.mai still holds the source (refreshed from itself, identical)
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe(source)
    // CLAUDE.md re-rendered fresh with today's date
    const rendered = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')
    expect(rendered).toMatch(/Date: 20\d\d-\d\d-\d\d/)
    expect(rendered).not.toContain('@date')
  })

  it('no-op when both CLAUDE.md and CLAUDE.mai exist but neither is a MarkdownAI doc', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), 'plain\n', 'utf8')
    writeFileSync(join(projectDir, 'CLAUDE.mai'), 'also plain\n', 'utf8')
    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    // Files untouched
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe('plain\n')
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe('also plain\n')
  })

  it('detects MarkdownAI doc behind YAML frontmatter', () => {
    const source = [
      '---',
      'description: project rules',
      '---',
      '@markdownai v1.0',
      '@date format="YYYY-MM-DD" label=t',
      'Today is {{ t }}.',
    ].join('\n')
    writeFileSync(join(projectDir, 'CLAUDE.md'), source, 'utf8')

    const out = runStart({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(existsSync(join(projectDir, 'CLAUDE.mai'))).toBe(true)
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe(source)
    const rendered = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')
    expect(rendered).toMatch(/Today is 20\d\d-\d\d-\d\d\./)
    expect(rendered).not.toContain('@date')
  })

  it('falls back to process.cwd() when stdin cwd is missing', () => {
    const out = runStart({})
    expect(out.code).toBe(0)
  })

  it('never blocks session start - returns exit 0 even on malformed stdin', () => {
    const proc = spawnSync('node', [startHookPath], { input: 'not-valid-json', encoding: 'utf8' })
    expect(proc.status).toBe(0)
  })
})

describe('SessionEnd hook (end-to-end via spawn)', () => {
  let projectDir: string
  let endHookPath: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-eshook-'))
    endHookPath = join(projectDir, 'sessionEnd.mjs')
    writeFileSync(endHookPath, SESSION_END_HOOK_SCRIPT, 'utf8')
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function runEnd(stdinJson: object): { code: number; stderr: string; stdout: string } {
    const proc = spawnSync('node', [endHookPath], {
      input: JSON.stringify(stdinJson),
      encoding: 'utf8',
    })
    return {
      code: proc.status ?? -1,
      stderr: proc.stderr ?? '',
      stdout: proc.stdout ?? '',
    }
  }

  it('exits 0 silently when no CLAUDE.mai exists (no MarkdownAI project)', () => {
    const out = runEnd({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toBe('')
  })

  it('restores CLAUDE.md from CLAUDE.mai backup', () => {
    const source = '@markdownai v1.0\n@date format="YYYY-MM-DD" label=t\nDate: {{ t }}\n'
    writeFileSync(join(projectDir, 'CLAUDE.mai'), source, 'utf8')
    writeFileSync(join(projectDir, 'CLAUDE.md'), 'rendered output\n', 'utf8')

    const out = runEnd({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(source)
    // Backup itself is preserved
    expect(readFileSync(join(projectDir, 'CLAUDE.mai'), 'utf8')).toBe(source)
  })

  it('creates CLAUDE.md from backup if the rendered file was deleted', () => {
    const source = '@markdownai v1.0\nHello.\n'
    writeFileSync(join(projectDir, 'CLAUDE.mai'), source, 'utf8')
    // No CLAUDE.md present (e.g. deleted by user mid-session)

    const out = runEnd({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(source)
  })

  it('falls back to process.cwd() when stdin cwd is missing', () => {
    const out = runEnd({})
    expect(out.code).toBe(0)
  })

  it('never blocks session shutdown - returns exit 0 on malformed stdin', () => {
    const proc = spawnSync('node', [endHookPath], { input: 'not-valid-json', encoding: 'utf8' })
    expect(proc.status).toBe(0)
  })

  it('full lifecycle: start backs up + renders, end restores - user always sees source', () => {
    // Need both hooks for this test
    const startHookPath = join(projectDir, 'sessionStart.mjs')
    writeFileSync(startHookPath, SESSION_START_HOOK_SCRIPT, 'utf8')
    const runStart = (json: object) => spawnSync('node', [startHookPath], { input: JSON.stringify(json), encoding: 'utf8' })

    const source = '@markdownai v1.0\n@date format="YYYY-MM-DD" label=t\nToday: {{ t }}\n'
    writeFileSync(join(projectDir, 'CLAUDE.md'), source, 'utf8')

    // Session 1
    runStart({ cwd: projectDir })
    const rendered1 = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')
    expect(rendered1).toMatch(/Today: 20\d\d-\d\d-\d\d/)
    expect(rendered1).not.toContain('@date')

    runEnd({ cwd: projectDir })
    // User opens CLAUDE.md - sees source again
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(source)

    // Session 2
    runStart({ cwd: projectDir })
    const rendered2 = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')
    expect(rendered2).toMatch(/Today: 20\d\d-\d\d-\d\d/)
    expect(rendered2).not.toContain('@date')

    runEnd({ cwd: projectDir })
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')).toBe(source)
  })
})
