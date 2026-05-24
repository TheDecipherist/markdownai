import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  SESSION_START_HOOK_SCRIPT,
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
    // The detection mirrors the parser rule: directives are only recognised
    // at line-start. Inside backticks the parser treats them as inline code,
    // and so should the refusal scanner.
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
  let hookPath: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-sshook-'))
    hookPath = join(projectDir, 'hook.mjs')
    writeFileSync(hookPath, SESSION_START_HOOK_SCRIPT, 'utf8')
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

  it('exits 0 silently when no CLAUDE.md.mai exists in the project', () => {
    const out = runHookWith({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toBe('')
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(false)
  })

  it('renders CLAUDE.md.mai to CLAUDE.md when source has only allowed directives', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md.mai'), [
      '@markdownai v1.0',
      '@date format="YYYY-MM-DD" label=today',
      '# Project Rules',
      '',
      'Today is {{ today }}.',
    ].join('\n'), 'utf8')

    const out = runHookWith({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(true)
    const rendered = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8')
    expect(rendered).toMatch(/Today is 20\d\d-\d\d-\d\d\./)
    expect(rendered).toContain('# Project Rules')
    expect(rendered).not.toContain('@date')
    expect(rendered).not.toContain('{{ today }}')
  })

  it('refuses to render when source uses @phase (and explains why)', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md.mai'), [
      '@markdownai v1.0',
      '@phase intro',
      'Intro content.',
      '@end',
    ].join('\n'), 'utf8')

    const out = runHookWith({ cwd: projectDir })
    expect(out.code).toBe(0)  // never blocks session start
    expect(out.stderr).toMatch(/refusing to render/i)
    expect(out.stderr).toContain('@phase')
    expect(out.stderr).toMatch(/lazy-load construct/)
    // CLAUDE.md must NOT be created when render is refused
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(false)
  })

  it('refuses to render when source uses @test (slow / runs test runner)', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md.mai'), [
      '@markdownai v1.0',
      '@test command="pnpm test"',
    ].join('\n'), 'utf8')

    const out = runHookWith({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toContain('@test')
    expect(out.stderr).toMatch(/runs the project test suite/)
  })

  it('refuses to render when source uses @mkdir (filesystem write)', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md.mai'), [
      '@markdownai v1.0',
      '@mkdir .mdd',
    ].join('\n'), 'utf8')

    const out = runHookWith({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toContain('@mkdir')
    expect(out.stderr).toMatch(/filesystem write/)
  })

  it('lists multiple refused directives at once', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md.mai'), [
      '@markdownai v1.0',
      '@phase a',
      '@test',
      '@http url="https://example.com"',
      '@end',
    ].join('\n'), 'utf8')

    const out = runHookWith({ cwd: projectDir })
    expect(out.code).toBe(0)
    expect(out.stderr).toContain('@phase')
    expect(out.stderr).toContain('@test')
    expect(out.stderr).toContain('@http')
  })

  it('falls back to process.cwd() when stdin cwd is missing', () => {
    // No CLAUDE.md.mai in process.cwd(), so hook should silently exit 0.
    const out = runHookWith({})
    expect(out.code).toBe(0)
  })

  it('never blocks session start - returns exit 0 even on internal errors', () => {
    // Empty stdin (no JSON) should not crash with non-zero exit
    const proc = spawnSync('node', [hookPath], {
      input: 'not-valid-json',
      encoding: 'utf8',
    })
    expect(proc.status).toBe(0)
  })
})
