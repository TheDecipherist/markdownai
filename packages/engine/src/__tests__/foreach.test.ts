import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@foreach', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-fe-'))
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

  it('iterates over @list output', () => {
    mkdirSync(join(projectDir, 'docs'), { recursive: true })
    writeFileSync(join(projectDir, 'docs/a.md'), '---\nid: a\n---\nA', 'utf8')
    writeFileSync(join(projectDir, 'docs/b.md'), '---\nid: b\n---\nB', 'utf8')
    writeFileSync(join(projectDir, 'docs/c.md'), '---\nid: c\n---\nC', 'utf8')
    const result = render(
      `@markdownai v1.0
@foreach doc in @list ./docs/ match="*.md"
- {{ doc }}
@end
`,
    )
    expect(result.output).toContain('docs/a.md')
    expect(result.output).toContain('docs/b.md')
    expect(result.output).toContain('docs/c.md')
  })

  it('iterates a frontmatter list field (comma-joined)', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: x\ndepends_on:\n  - 01-foo\n  - 02-bar\n  - 03-baz\n---\nbody', 'utf8')
    const result = render(
      `@markdownai v1.0
@foreach dep in @read-frontmatter path="doc.md" field="depends_on"
* {{ dep }}
@end
`,
    )
    expect(result.output).toContain('* 01-foo')
    expect(result.output).toContain('* 02-bar')
    expect(result.output).toContain('* 03-baz')
  })

  it('nested directives in body resolve per-iteration', () => {
    mkdirSync(join(projectDir, 'docs'), { recursive: true })
    writeFileSync(join(projectDir, 'docs/01-a.md'), '---\nid: 01-a\nstatus: complete\n---\nA', 'utf8')
    writeFileSync(join(projectDir, 'docs/02-b.md'), '---\nid: 02-b\nstatus: draft\n---\nB', 'utf8')
    const result = render(
      `@markdownai v1.0
@foreach doc in @list ./docs/ match="*.md"
@read-frontmatter path="{{ doc }}" field="status" label=s
{{ doc }} → {{ s }}
@end
`,
    )
    expect(result.output).toContain('docs/01-a.md → complete')
    expect(result.output).toContain('docs/02-b.md → draft')
  })

  it('empty source produces no body output', () => {
    mkdirSync(join(projectDir, 'empty'), { recursive: true })
    const result = render(
      `@markdownai v1.0
before
@foreach x in @list ./empty/ match="*.md"
body for {{ x }}
@end
after
`,
    )
    expect(result.output).toContain('before')
    expect(result.output).toContain('after')
    expect(result.output).not.toContain('body for')
  })

  it('@if inside @foreach selects per-item', () => {
    mkdirSync(join(projectDir, 'docs'), { recursive: true })
    writeFileSync(join(projectDir, 'docs/01.md'), '---\nstatus: complete\n---\n', 'utf8')
    writeFileSync(join(projectDir, 'docs/02.md'), '---\nstatus: draft\n---\n', 'utf8')
    writeFileSync(join(projectDir, 'docs/03.md'), '---\nstatus: complete\n---\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@foreach doc in @list ./docs/ match="*.md"
@read-frontmatter path="{{ doc }}" field="status" label=s
@if {{ s }} == "complete"
- {{ doc }} (done)
@endif
@end
`,
    )
    expect(result.output).toContain('docs/01.md (done)')
    expect(result.output).toContain('docs/03.md (done)')
    expect(result.output).not.toContain('docs/02.md (done)')
  })

  it('iterates over a labeled variable', () => {
    const result = render(
      `@markdownai v1.0
@date format="YYYY-MM-DD" label=today
@foreach d in {{ today }}
got: {{ d }}
@end
`,
    )
    expect(result.output).toMatch(/got: 20\d\d-\d\d-\d\d/)
  })

  it('iterates a literal comma list', () => {
    const result = render(
      `@markdownai v1.0
@foreach color in red, green, blue
+ {{ color }}
@end
`,
    )
    expect(result.output).toContain('+ red')
    expect(result.output).toContain('+ green')
    expect(result.output).toContain('+ blue')
  })

  it('restores outer binding after iteration ends', () => {
    const result = render(
      `@markdownai v1.0
@set x = "outer"
before: {{ x }}
@foreach x in red, green
inner: {{ x }}
@end
after: {{ x }}
`,
    )
    expect(result.output).toContain('before: outer')
    expect(result.output).toContain('inner: red')
    expect(result.output).toContain('inner: green')
    expect(result.output).toContain('after: outer')
  })

  it('nested @foreach works', () => {
    const result = render(
      `@markdownai v1.0
@foreach outer in a, b
@foreach inner in 1, 2
({{ outer }},{{ inner }})
@end
@end
`,
    )
    expect(result.output).toContain('(a,1)')
    expect(result.output).toContain('(a,2)')
    expect(result.output).toContain('(b,1)')
    expect(result.output).toContain('(b,2)')
  })
})
