import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

/**
 * Regression coverage for @include / @import path expansion.
 *
 * Before the fix: `@include ${CLAUDE_SKILL_DIR}/templates/foo.md` was
 * resolved as a literal path containing the unexpanded variable and
 * failed with ENOENT. The write directives (@copy, @mkdir, etc.) already
 * expanded the same set; this brings the source directives to parity.
 */
describe('@include and @import expand ${VAR} placeholders', () => {
  let skillDir: string
  let projectDir: string

  beforeEach(() => {
    skillDir = mkdtempSync(join(tmpdir(), 'mai-skill-'))
    projectDir = mkdtempSync(join(tmpdir(), 'mai-proj-'))
    mkdirSync(join(skillDir, 'templates'), { recursive: true })
  })

  afterEach(() => {
    for (const d of [skillDir, projectDir]) {
      try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  function render(content: string, opts: { allowedSourcePaths?: string[] } = {}) {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        docDir: projectDir,
        skillContext: { args: '', argsList: [], namedArgs: {}, sessionId: '', effort: '', skillDir },
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          sourceJail: projectDir,
          allowedSourcePaths: opts.allowedSourcePaths ?? [`${skillDir}/**`],
        },
      },
    })
  }

  it('@include expands ${CLAUDE_SKILL_DIR}', () => {
    writeFileSync(join(skillDir, 'templates/greeting.md'),
      '@markdownai v1.0\nHello from the template!\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@include \${CLAUDE_SKILL_DIR}/templates/greeting.md
`,
    )
    expect(result.output).toContain('Hello from the template!')
  })

  it('@import expands ${CLAUDE_SKILL_DIR}', () => {
    writeFileSync(join(skillDir, 'templates/macros.md'),
      `@markdownai v1.0
@define greet
Hi from a macro.
@end
`, 'utf8')
    const result = render(
      `@markdownai v1.0
@import \${CLAUDE_SKILL_DIR}/templates/macros.md
@call greet
`,
    )
    expect(result.output).toContain('Hi from a macro.')
  })

  it('@include with unset variable expands to empty and fails closed', () => {
    const result = render(
      `@markdownai v1.0
@include \${NEVER_SET_VAR}/templates/x.md
`,
    )
    // Expansion produces "/templates/x.md" which is then either blocked by
    // the source jail or fails readFileSync. Either signal is acceptable.
    const noise = result.warnings.join('\n') + ' ' + result.errors.join('\n')
    expect(noise).toMatch(/blocked|cannot read|absolute paths/)
  })

  it('@include with relative path still works (parity check)', () => {
    writeFileSync(join(projectDir, 'local.md'),
      '@markdownai v1.0\nLocal content.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@include ./local.md
`,
    )
    expect(result.output).toContain('Local content.')
  })
})
