import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@include {{ }} dynamic path expressions', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-dynpath-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function render(content: string, args: string = '') {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        docDir: projectDir,
        skillContext: {
          args,
          argsList: args.trim() ? args.trim().split(/\s+/) : [],
          namedArgs: {},
          sessionId: '',
          effort: '',
          skillDir: '',
        },
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          sourceJail: projectDir,
          allowedSourcePaths: [],
        },
      },
    })
  }

  it('resolves {{arg0}} to the first argument and includes the correct file', () => {
    writeFileSync(join(projectDir, 'audit-mode.md'),
      '@markdownai v1.0\nAudit content.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@include ./{{arg0}}-mode.md /
`,
      'audit',
    )
    expect(result.output).toContain('Audit content.')
    expect(result.warnings).toHaveLength(0)
  })

  it('resolves different arg values to different files', () => {
    writeFileSync(join(projectDir, 'build-mode.md'),
      '@markdownai v1.0\nBuild content.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@include ./{{arg0}}-mode.md /
`,
      'build',
    )
    expect(result.output).toContain('Build content.')
  })

  it('uses || fallback when arg0 is empty', () => {
    writeFileSync(join(projectDir, 'audit-mode.md'),
      '@markdownai v1.0\nDefault audit.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@include ./{{arg0 || 'audit'}}-mode.md /
`,
      '',
    )
    expect(result.output).toContain('Default audit.')
    expect(result.warnings).toHaveLength(0)
  })

  it('supports env.VAR in path expression', () => {
    writeFileSync(join(projectDir, 'prod-config.md'),
      '@markdownai v1.0\nProd config.\n', 'utf8')
    const filePath = join(projectDir, 'main.md')
    const content = `@markdownai v1.0
@include ./{{env.APP_ENV}}-config.md /
`
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    const result = execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        docDir: projectDir,
        env: { APP_ENV: 'prod' },
        skillContext: { args: '', argsList: [], namedArgs: {}, sessionId: '', effort: '', skillDir: '' },
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null, sourceJail: projectDir, allowedSourcePaths: [] },
      },
    })
    expect(result.output).toContain('Prod config.')
  })

  it('supports multiple {{ }} segments in one path', () => {
    writeFileSync(join(projectDir, 'v2-report.md'),
      '@markdownai v1.0\nV2 report.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@include ./{{arg0}}-{{arg1}}.md /
`,
      'v2 report',
    )
    expect(result.output).toContain('V2 report.')
  })

  it('errors when expression evaluates to empty string', () => {
    // arg0 is '' with no fallback — evalExpression returns '' → FatalError stored in errors
    const result = render(
      `@markdownai v1.0
@include ./{{arg0}}-mode.md /
`,
      '',
    )
    expect(result.errors.some(e => e.includes('cannot resolve file'))).toBe(true)
  })

  it('errors when expression evaluates to undefined (unknown variable)', () => {
    // noSuchVar is not in sandbox — evalExpression returns '' → FatalError stored in errors
    const result = render(
      `@markdownai v1.0
@include ./{{noSuchVar}}-mode.md /
`,
      '',
    )
    expect(result.errors.some(e => e.includes('cannot resolve file'))).toBe(true)
  })

  it('blocks path traversal introduced by dynamic expression value', () => {
    const result = render(
      `@markdownai v1.0
@include ./{{arg0}}-mode.md /
`,
      '../../etc/shadow',
    )
    const noise = result.warnings.join('\n') + ' ' + result.errors.join('\n')
    expect(noise).toMatch(/blocked|confinement/)
  })

  it('emits a warning (not fatal) when the resolved file does not exist', () => {
    const result = render(
      `@markdownai v1.0
@include ./{{arg0}}-mode.md /
`,
      'nonexistent',
    )
    expect(result.warnings.some(w => w.includes('nonexistent'))).toBe(true)
    expect(result.output).toBe('')
  })

  it('@foreach loop variable is accessible in {{ }} include path', () => {
    writeFileSync(join(projectDir, 'audit-section.md'),
      '@markdownai v1.0\nAUDIT SECTION\n', 'utf8')
    writeFileSync(join(projectDir, 'build-section.md'),
      '@markdownai v1.0\nBUILD SECTION\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@foreach mode in audit,build
@include ./{{mode}}-section.md /
@foreach-end
`,
    )
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('AUDIT SECTION')
    expect(result.output).toContain('BUILD SECTION')
  })

  it('@foreach loop variable works in {{ }} path with JS fallback', () => {
    writeFileSync(join(projectDir, 'build-section.md'),
      '@markdownai v1.0\nBUILD SECTION\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@foreach mode in build
@include ./{{mode || 'audit'}}-section.md /
@foreach-end
`,
    )
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('BUILD SECTION')
  })
})
