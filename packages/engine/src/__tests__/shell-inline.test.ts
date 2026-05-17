import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

function render(source: string, allowShell = false, allowPatterns: string[] = ['*']): string {
  const ast = parse(source)
  return execute(ast, {
    ctx: {
      security: {
        allowShell,
        allowHttp: false,
        allowDb: false,
        jailRoot: null,
        shellConfig: {
          enabled: true,
          allow_patterns: allowPatterns,
          deny_patterns: [],
          allow_network: false,
          require_confirmation: false,
          audit_log: false,
        },
      },
    },
  }).output
}

function getWarnings(source: string, allowShell = false, allowPatterns: string[] = ['*']): string[] {
  const ast = parse(source)
  return execute(ast, {
    ctx: {
      security: {
        allowShell,
        allowHttp: false,
        allowDb: false,
        jailRoot: null,
        shellConfig: {
          enabled: true,
          allow_patterns: allowPatterns,
          deny_patterns: [],
          allow_network: false,
          require_confirmation: false,
          audit_log: false,
        },
      },
    },
  }).warnings
}

const DOC_PREFIX = '@markdownai v1.0\n'

describe('shell-inline: blocked by default', () => {
  it('blocks shell inline when allowShell is false and emits a warning', () => {
    const source = `${DOC_PREFIX}Branch: !${'`'}echo main${'`'}`
    const out = render(source, false)
    const warns = getWarnings(source, false)
    expect(out).toBe('Branch: ')
    expect(warns.length).toBeGreaterThan(0)
    expect(warns[0]).toMatch(/allowShell is false/)
  })

  it('warning message includes the blocked command', () => {
    const source = `${DOC_PREFIX}Output: !${'`'}echo hello${'`'}`
    const warns = getWarnings(source, false)
    expect(warns[0]).toContain('echo hello')
  })
})

describe('shell-inline: executed when allowed', () => {
  it('runs command and inlines output when allowShell is true', () => {
    const source = `${DOC_PREFIX}!${'`'}echo hello${'`'}`
    const out = render(source, true)
    expect(out).toBe('hello')
  })

  it('inlines output within a sentence', () => {
    const source = `${DOC_PREFIX}Branch: !${'`'}echo main${'`'}`
    const out = render(source, true)
    expect(out).toBe('Branch: main')
  })

  it('processes multiple shell inlines on one line', () => {
    const source = `${DOC_PREFIX}A=!${'`'}echo foo${'`'} B=!${'`'}echo bar${'`'}`
    const out = render(source, true)
    expect(out).toBe('A=foo B=bar')
  })
})

describe('shell-inline: regular backtick spans are not treated as shell inlines', () => {
  it('leaves plain backtick code span untouched', () => {
    const source = `${DOC_PREFIX}Run the \`npm install\` command`
    const out = render(source, true)
    expect(out).toBe('Run the `npm install` command')
  })

  it('does not confuse code span with shell inline', () => {
    const source = `${DOC_PREFIX}Use \`echo\` not !${'`'}echo hi${'`'}`
    const out = render(source, true)
    expect(out).toBe('Use `echo` not hi')
  })
})

describe('shell-inline: fenced code blocks are immune', () => {
  it('does not evaluate shell inline inside a fenced code block', () => {
    const source = [
      DOC_PREFIX.trim(),
      '```bash',
      '!`echo not-executed`',
      '```',
    ].join('\n')
    const out = render(source, true)
    expect(out).toContain('!`echo not-executed`')
  })
})

describe('shell-inline: passthrough mode', () => {
  it('leaves raw shell inline syntax in output when shell-inline="passthrough"', () => {
    const source = [
      '@markdownai v1.0 shell-inline="passthrough"',
      'Branch: !`echo main`',
    ].join('\n')
    const out = render(source, true)
    expect(out).toBe('Branch: !`echo main`')
  })

  it('passthrough mode emits no warnings for shell inline patterns', () => {
    const source = [
      '@markdownai v1.0 shell-inline="passthrough"',
      '!`echo hi`',
    ].join('\n')
    const warns = getWarnings(source, true)
    expect(warns).toHaveLength(0)
  })
})

describe('shell-inline: failed commands', () => {
  it('emits warning and returns empty string for a nonexistent program without crashing', () => {
    const source = `${DOC_PREFIX}!${'`'}nonexistent-program-xyz-abc${'`'}`
    const out = render(source, true)
    const warns = getWarnings(source, true)
    expect(out).toBe('')
    expect(warns.length).toBeGreaterThan(0)
    expect(warns[0]).toContain('nonexistent-program-xyz-abc')
  })
})

describe('shell-inline: deny patterns block allowed shell commands', () => {
  it('blocks a command matching a deny pattern even when allowShell is true', () => {
    const ast = parse(`${DOC_PREFIX}!${'`'}rm -rf /${'`'}`)
    const result = execute(ast, {
      ctx: {
        security: {
          allowShell: true,
          allowHttp: false,
          allowDb: false,
          jailRoot: null,
          shellConfig: {
            enabled: true,
            allow_patterns: ['*'],
            deny_patterns: ['rm *'],
            allow_network: false,
            require_confirmation: false,
            audit_log: false,
          },
        },
      },
    })
    expect(result.output).toBe('')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/Shell inline blocked/)
  })
})
