import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('file.frontmatterField (@if helper)', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-fmf-'))
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

  it('returns the field value from frontmatter', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nstatus: complete\n---\nbody', 'utf8')
    const result = render(
      `@markdownai v1.0
@if file.frontmatterField("doc.md", "status") == "complete"
done
@else
not done
@if-end
`,
    )
    expect(result.output).toContain('done')
    expect(result.output).not.toContain('not done')
  })

  it('returns empty string when field is absent', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: x\n---\nbody', 'utf8')
    const result = render(
      `@markdownai v1.0
@if file.frontmatterField("doc.md", "status") == ""
empty
@else
present
@if-end
`,
    )
    expect(result.output).toContain('empty')
  })

  it('returns empty string when file does not exist', () => {
    const result = render(
      `@markdownai v1.0
@if file.frontmatterField("missing.md", "status") == ""
missing
@if-end
`,
    )
    expect(result.output).toContain('missing')
  })

  it('reads a list-typed field (comma-joined)', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\ntags:\n  - alpha\n  - beta\n---\nbody', 'utf8')
    const result = render(
      `@markdownai v1.0
@if file.frontmatterField("doc.md", "tags").includes("beta")
has beta
@if-end
`,
    )
    expect(result.output).toContain('has beta')
  })

  // read_frontmatter(path, field) is the top-level expression form used for
  // file-driven rendering: bind a frontmatter field into a var with @set
  // WITHOUT @read-frontmatter's inline echo.
  it('read_frontmatter binds a field via @set with no inline echo', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: 03-widget\nstatus: complete\n---\nbody', 'utf8')
    const result = render(
      `@markdownai v1.0
@set s = {{ read_frontmatter("doc.md", "status") }} /
@set i = {{ read_frontmatter("doc.md", "id") }} /
id={{ i }} status={{ s }}`,
    )
    expect(result.output).toContain('id=03-widget status=complete')
    // no echo of the raw values before the formatted line
    expect(result.output).not.toContain('\ncomplete\n')
  })

  it('read_frontmatter is usable directly in @if and returns empty for a missing file', () => {
    writeFileSync(join(projectDir, 'doc.md'), '---\nstatus: draft\n---\nbody', 'utf8')
    const r1 = render(
      `@markdownai v1.0
@if {{ read_frontmatter("doc.md", "status") == "draft" }}
yes
@if-end`,
    )
    expect(r1.output).toContain('yes')
    const r2 = render(
      `@markdownai v1.0
@if {{ read_frontmatter("nope.md", "status") == "" }}
missing
@if-end`,
    )
    expect(r2.output).toContain('missing')
  })
})
