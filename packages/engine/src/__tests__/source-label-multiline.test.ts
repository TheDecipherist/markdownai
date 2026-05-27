import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

/**
 * Regression coverage for the label= multi-line capture fix.
 *
 * Before the fix: source directives with multi-line output (read, list,
 * tree, query) stored only the FIRST line in ctx.envFiles[label] — the rest
 * was discarded. Discovered during the MDD Wave 5 parity audit when
 * `@read ./package.json path="devDependencies" label=deps` captured only the
 * first dep name.
 *
 * After the fix: multi-line sources store the joined output; scalar-shaped
 * sources (count, date) keep their first-line semantic.
 */
describe('source directive label= captures multi-line output', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-lblm-'))
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

  it('@read of a multi-line file stores the full joined content in label', () => {
    writeFileSync(join(projectDir, 'words.txt'), 'alpha\nbeta\ngamma\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read ./words.txt label=w /
captured: {{ w }}
`,
    )
    expect(result.output).toContain('captured: alpha\nbeta\ngamma')
  })

  it('@list stores the full file list in label', () => {
    mkdirSync(join(projectDir, 'docs'), { recursive: true })
    writeFileSync(join(projectDir, 'docs/a.md'), '', 'utf8')
    writeFileSync(join(projectDir, 'docs/b.md'), '', 'utf8')
    writeFileSync(join(projectDir, 'docs/c.md'), '', 'utf8')
    const result = render(
      `@markdownai v1.0
@list ./docs/ match="*.md" label=files /
list: {{ files }}
`,
    )
    expect(result.output).toContain('docs/a.md')
    expect(result.output).toContain('docs/b.md')
    expect(result.output).toContain('docs/c.md')
  })

  it('@count keeps single-line scalar semantic', () => {
    mkdirSync(join(projectDir, 'docs'), { recursive: true })
    writeFileSync(join(projectDir, 'docs/a.md'), '', 'utf8')
    writeFileSync(join(projectDir, 'docs/b.md'), '', 'utf8')
    const result = render(
      `@markdownai v1.0
@count ./docs/ match="*.md" label=n /
n is {{ n }}
`,
    )
    expect(result.output).toContain('n is 2')
  })

  it('@date keeps single-line scalar semantic', () => {
    const result = render(
      `@markdownai v1.0
@date format="YYYY-MM-DD" label=today /
today is {{ today }}
`,
    )
    expect(result.output).toMatch(/today is 20\d\d-\d\d-\d\d/)
  })

  it('multi-line label supports substring tests', () => {
    writeFileSync(join(projectDir, 'package.json'),
      JSON.stringify({
        dependencies: { foo: '1.0', bar: '2.0' },
        devDependencies: { typescript: '5.0', vitest: '1.0' },
      }, null, 2),
      'utf8')
    const result = render(
      `@markdownai v1.0
@read ./package.json path="devDependencies" label=devdeps /
@if devdeps.includes("typescript")
project uses typescript
@else
project does not use typescript
@if-end
`,
    )
    expect(result.output).toContain('project uses typescript')
  })

  it('multi-line label feeds @foreach as a source', () => {
    writeFileSync(join(projectDir, 'list.txt'), 'apple\nbanana\ncherry\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read ./list.txt label=fruits /
@foreach f in {{ fruits }}
- {{ f }}
@foreach-end
`,
    )
    expect(result.output).toContain('- apple')
    expect(result.output).toContain('- banana')
    expect(result.output).toContain('- cherry')
  })
})
