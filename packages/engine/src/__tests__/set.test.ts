import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@set', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-set-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function render(content: string) {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null },
      },
    })
  }

  it('binds a literal string', () => {
    const result = render(
      `@markdownai v1.0
@set name = "Alice" /
Hello, {{ name }}.
`,
    )
    expect(result.output).toContain('Hello, Alice.')
  })

  it('binds the output of a directive', () => {
    const result = render(
      `@markdownai v1.0
@set today = @date format="YYYY-MM-DD" /
Today is {{ today }}.
`,
    )
    expect(result.output).toMatch(/Today is 20\d\d-\d\d-\d\d\./)
  })

  it('binds an interpolated value', () => {
    const result = render(
      `@markdownai v1.0
@set greeting = "hello" /
@set message = "{{ greeting }} world" /
{{ message }}
`,
    )
    expect(result.output).toContain('hello world')
  })

  it('overrides a previously set value', () => {
    const result = render(
      `@markdownai v1.0
@set x = "first" /
before: {{ x }}
@set x = "second" /
after: {{ x }}
`,
    )
    expect(result.output).toContain('before: first')
    expect(result.output).toContain('after: second')
  })

  it('warns when missing var name', () => {
    const result = render(
      `@markdownai v1.0
@set = "no name" /
`,
    )
    expect(result.warnings.join('\n')).toMatch(/missing variable name/i)
  })

  it('binds a single-quoted literal', () => {
    const result = render(
      `@markdownai v1.0
@set greeting = 'hi' /
> {{ greeting }}
`,
    )
    expect(result.output).toContain('> hi')
  })

  it('binds the output of @count', () => {
    writeFileSync(join(projectDir, 'a.txt'), 'one\ntwo\nthree\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@set lines = @count ./a.txt /
Lines: {{ lines }}
`,
    )
    // @count of a file returns line count.
    expect(result.output).toMatch(/Lines: [34]/)
  })
})
