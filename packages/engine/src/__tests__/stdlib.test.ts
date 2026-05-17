import { describe, it, expect } from 'vitest'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

// Confirms stdlib macros are available in every @markdownai document without any @import.
// Tests use real stdlib macros. allowShell: true is required because stdlib macros run
// shell commands; the default security context blocks shell for untrusted documents.

const shellCtx = { security: { allowShell: true, allowHttp: false, allowDb: false, jailRoot: null } }

function run(src: string, shell = false) {
  const ast = parse(src)
  return execute(ast, shell ? { ctx: shellCtx } : undefined)
}

describe('stdlib — auto-loaded macros', () => {

  it('stdlib macros are available without @import', () => {
    // Verify stdlib loads by checking that @call git-branch resolves without errors.
    // Shell disabled here - just tests that the macro exists, not that it runs.
    const result = run(`@markdownai
@call git-branch
branch: {{ current_branch }}
`)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/^branch:/)
  })

  it('git-status macro runs without errors', () => {
    const result = run(`@markdownai
@call git-status
`, true)
    expect(result.errors).toHaveLength(0)
  })

  it('git-log macro produces commit history', () => {
    const result = run(`@markdownai
@call git-log
`, true)
    expect(result.errors).toHaveLength(0)
    // Should have at least one commit in this repo
    expect(result.warnings.some(w => w.includes('git-log'))).toBe(false)
  })

  it('project-manager detects a package manager', () => {
    const result = run(`@markdownai
@call project-manager
manager: {{ pkg_manager }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/manager: (npm|pnpm|yarn|bun|cargo|go|pip|unknown)/)
  })

  it('env-node reports a version string', () => {
    const result = run(`@markdownai
@call env-node
node: {{ node_version }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/node: (v\d+\.\d+\.\d+|not installed)/)
  })

  it('env-os returns a known OS type', () => {
    const result = run(`@markdownai
@call env-os
os: {{ os_type }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/os: (wsl|linux|macos|windows)/)
  })

  it('fs-count with ext parameter works', () => {
    const result = run(`@markdownai
@call fs-count ext=ts
count: {{ file_count }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/count: \d+/)
  })

  it('code-grep with pattern parameter works', () => {
    const result = run(`@markdownai
@call code-grep pattern=execute
results: {{ grep_results }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/results: .+/)
  })

  it('user-defined macro overrides stdlib macro', () => {
    // project-manager is a stdlib macro; user redefines it here
    const result = run(`@markdownai
@define project-manager
@query bash -c "echo bespoke" label=pkg_manager
@end
@call project-manager
manager: {{ pkg_manager }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('manager: bespoke')
  })

  it('env-has with cmd parameter returns true or false', () => {
    const result = run(`@markdownai
@call env-has cmd=node
available: {{ cmd_available }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/available: (true|false)/)
  })

  it('code-any-types returns a number', () => {
    const result = run(`@markdownai
@call code-any-types
any count: {{ any_count }}
`, true)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toMatch(/any count: \d+/)
  })

})
