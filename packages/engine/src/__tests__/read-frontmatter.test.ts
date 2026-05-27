import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@read-frontmatter', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-readfm-'))
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
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
        },
      },
    })
  }

  it('reads a scalar field value', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: 01-test\nstatus: complete\ntitle: Test\n---\n\nBody.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="doc.md" field="status" label=doc_status /
Status is {{ doc_status }}.
`,
    )
    expect(result.output).toContain('Status is complete.')
  })

  it('reads a list field as comma-separated text', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: 01-test\nsource_files:\n  - src/a.ts\n  - src/b.ts\n---\n\nBody.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="doc.md" field="source_files" label=files /
Files: {{ files }}.
`,
    )
    expect(result.output).toContain('Files: src/a.ts, src/b.ts')
  })

  it('returns empty when field is missing (no warning)', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: 01-test\n---\n\nBody.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="doc.md" field="status" label=doc_status /
Status: "{{ doc_status }}".
`,
    )
    expect(result.output).toContain('Status: "".')
    // No warning for missing field — only for missing frontmatter block.
    const fmWarning = result.warnings.find(w => w.includes('no YAML frontmatter'))
    expect(fmWarning).toBeUndefined()
  })

  it('warns when file has no frontmatter block', () => {
    writeFileSync(join(projectDir, 'doc.md'), 'Plain text, no frontmatter.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="doc.md" field="status" /
`,
    )
    expect(result.warnings.join('\n')).toMatch(/no YAML frontmatter/i)
  })

  it('emits value as a line when no label is given', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nstatus: ready\n---\n\nBody.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="doc.md" field="status" /
`,
    )
    expect(result.output).toContain('ready')
  })

  it('feeds @if checks via the label', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nstatus: complete\n---\n\nBody.\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="doc.md" field="status" label=s /
@if {{ s }} == "complete"
  Doc is complete.
@if-end
@if {{ s }} == "draft"
  Doc is draft.
@if-end
`,
    )
    expect(result.output).toContain('Doc is complete.')
    expect(result.output).not.toContain('Doc is draft.')
  })

  it('warns when file does not exist', () => {
    const result = render(
      `@markdownai v1.0
@read-frontmatter path="missing.md" field="status" /
`,
    )
    expect(result.warnings.join('\n')).toMatch(/does not exist/i)
  })
})
