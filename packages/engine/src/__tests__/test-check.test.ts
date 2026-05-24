import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@test and @check', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-tc-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function render(content: string, opts: { allowShell?: boolean; shellConfig?: import('../security/config.js').ShellSecurityConfig } = {}) {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    const ctx: import('../context.js').EngineContext['security'] = {
      allowShell: opts.allowShell ?? false,
      allowHttp: false, allowDb: false,
      jailRoot: null,
    }
    if (opts.shellConfig) ctx.shellConfig = opts.shellConfig
    return execute(ast, {
      filePath,
      ctx: { cwd: projectDir, security: ctx },
    })
  }

  const trueShell: import('../security/config.js').ShellSecurityConfig = {
    enabled: true,
    allow_patterns: ['true', 'false', 'echo *', 'sh -c *'],
    deny_patterns: [],
    allow_network: false,
    require_confirmation: false,
    audit_log: false,
  }

  describe('@test', () => {
    it('runs an explicit command and labels exit code', () => {
      const result = render(
        `@markdownai v1.0
@test command="true" label=t
exit={{ t_exit }}
summary={{ t_summary }}
`,
        { allowShell: true, shellConfig: trueShell },
      )
      expect(result.output).toContain('exit=0')
      // {{ t_summary }} is best-effort recognizer output, additive only.
      expect(result.output).toMatch(/summary=test passed/i)
    })

    it('surfaces failure with non-zero exit', () => {
      const result = render(
        `@markdownai v1.0
@test command="false" label=t
exit={{ t_exit }}
`,
        { allowShell: true, shellConfig: trueShell },
      )
      expect(result.output).toContain('exit=1')
    })

    it('returns the full runner output verbatim (not truncated, not summarized)', () => {
      // The engine must never substitute a summary for the real output.
      // Claude needs the runner's actual stdout/stderr to diagnose failures.
      const result = render(
        `@markdownai v1.0
@test command="echo line-one && echo line-two && echo line-three" label=t
full={{ t }}
`,
        { allowShell: true, shellConfig: trueShell },
      )
      expect(result.output).toContain('line-one')
      expect(result.output).toContain('line-two')
      expect(result.output).toContain('line-three')
    })

    it('full output is emitted inline at the directive position', () => {
      const result = render(
        `@markdownai v1.0
START
@test command="echo hello-from-test"
END
`,
        { allowShell: true, shellConfig: trueShell },
      )
      // Output must appear between START and END markers (inline substitution).
      expect(result.output).toMatch(/START[\s\S]*hello-from-test[\s\S]*END/)
    })

    it('auto-detects from package.json scripts.test', () => {
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
        name: 'tmp',
        scripts: { test: 'true' },
      }), 'utf8')
      // Allow `npm run test --silent`
      const npmShell: import('../security/config.js').ShellSecurityConfig = {
        enabled: true,
        allow_patterns: ['npm run *'],
        deny_patterns: [],
        allow_network: false,
        require_confirmation: false,
        audit_log: false,
      }
      const result = render(
        `@markdownai v1.0
@test label=t
exit={{ t_exit }}
`,
        { allowShell: true, shellConfig: npmShell },
      )
      // `npm run test --silent` with `test: "true"` always exits 0.
      expect(result.output).toContain('exit=0')
    })

    it('warns when no command and no package.json', () => {
      const result = render(
        `@markdownai v1.0
@test
`,
        { allowShell: true, shellConfig: trueShell },
      )
      expect(result.warnings.join('\n')).toMatch(/no command/i)
    })

    it('blocked when shell is disabled', () => {
      const result = render(
        `@markdownai v1.0
@test command="true"
`,
        { allowShell: false },
      )
      expect(result.warnings.join('\n')).toMatch(/shell execution disabled/i)
    })

    it('blocked when command not in shell allowlist', () => {
      const result = render(
        `@markdownai v1.0
@test command="rm -rf /"
`,
        { allowShell: true, shellConfig: trueShell },
      )
      expect(result.warnings.join('\n')).toMatch(/blocked/i)
    })
  })

  describe('@check', () => {
    it('auto-detects from package.json scripts.typecheck', () => {
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
        name: 'tmp',
        scripts: { typecheck: 'true' },
      }), 'utf8')
      const npmShell: import('../security/config.js').ShellSecurityConfig = {
        enabled: true,
        allow_patterns: ['npm run *'],
        deny_patterns: [],
        allow_network: false,
        require_confirmation: false,
        audit_log: false,
      }
      const result = render(
        `@markdownai v1.0
@check label=c
exit={{ c_exit }}
`,
        { allowShell: true, shellConfig: npmShell },
      )
      expect(result.output).toContain('exit=0')
    })

    it('explicit command runs without package.json', () => {
      const result = render(
        `@markdownai v1.0
@check command="true" label=c
exit={{ c_exit }}
`,
        { allowShell: true, shellConfig: trueShell },
      )
      expect(result.output).toContain('exit=0')
    })

    it('prefers typecheck over lint over build when multiple scripts exist', () => {
      writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
        name: 'tmp',
        scripts: { build: 'false', lint: 'false', typecheck: 'true' },
      }), 'utf8')
      const npmShell: import('../security/config.js').ShellSecurityConfig = {
        enabled: true,
        allow_patterns: ['npm run *'],
        deny_patterns: [],
        allow_network: false,
        require_confirmation: false,
        audit_log: false,
      }
      const result = render(
        `@markdownai v1.0
@check label=c
exit={{ c_exit }}
`,
        { allowShell: true, shellConfig: npmShell },
      )
      // Should pick typecheck=true → exit 0.
      expect(result.output).toContain('exit=0')
    })
  })
})
