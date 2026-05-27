import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@update-frontmatter list addressing', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-ufml-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function makeFsConfig() {
    return {
      source_root: 'auto',
      data_root: 'cwd',
      allowed_source_paths: [],
      allowed_data_paths: [],
      write_enabled: true,
      write_root: 'cwd',
      allowed_write_paths: [],
      additional_block_paths: [],
      additional_block_patterns: [],
      allow_unmasked_paths: [],
      allow_unmasked_patterns: [],
      user_masking_patterns: [],
    }
  }

  function render(content: string) {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null, filesystemConfig: makeFsConfig() },
      },
    })
  }

  it('appends a scalar item to a block list', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nknown_issues:\n  - issue one\n  - issue two\n---\n\nbody\n', 'utf8')
    render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="known_issues[append]" value="issue three" /
`,
    )
    const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
    expect(after).toMatch(/- issue three/)
    // existing items still there:
    expect(after).toMatch(/- issue one/)
    expect(after).toMatch(/- issue two/)
  })

  it('creates the field if absent on append', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: x\n---\n\nbody\n', 'utf8')
    render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="tags[append]" value="new-tag" /
`,
    )
    const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
    expect(after).toMatch(/tags:\n\s+- new-tag/)
  })

  it('replaces a scalar item by index', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\ntags:\n  - red\n  - green\n  - blue\n---\n\nbody\n', 'utf8')
    render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="tags[1]" value="emerald" /
`,
    )
    const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
    expect(after).toMatch(/- red/)
    expect(after).toMatch(/- emerald/)
    expect(after).not.toMatch(/- green/)
    expect(after).toMatch(/- blue/)
  })

  it('replaces a sub-field on a block-mapping item', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nsatisfies_contracts:\n  - from: 03-auth\n    function: maskUser\n    status: pending\n    verified_at: ""\n---\n\nbody\n', 'utf8')
    render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="satisfies_contracts[0].status" value="done" /
@update-frontmatter path="doc.md" field="satisfies_contracts[0].verified_at" value="src/handlers/auth.ts:42" /
`,
    )
    const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
    expect(after).toContain('status: done')
    expect(after).toContain('verified_at: src/handlers/auth.ts:42')
    expect(after).not.toContain('status: pending')
  })

  it('warns on out-of-bounds index', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\ntags:\n  - red\n---\n\nbody\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="tags[5]" value="oops" /
`,
    )
    expect(result.warnings.join('\n')).toMatch(/out of bounds/i)
  })

  it('warns on missing field for non-append', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nid: x\n---\n\nbody\n', 'utf8')
    const result = render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="tags[0]" value="nope" /
`,
    )
    expect(result.warnings.join('\n')).toMatch(/no `tags:` field/)
  })

  it('handles append on an empty inline list', () => {
    writeFileSync(join(projectDir, 'doc.md'),
      '---\nknown_issues: []\n---\n\nbody\n', 'utf8')
    render(
      `@markdownai v1.0
@update-frontmatter path="doc.md" field="known_issues[append]" value="first" /
`,
    )
    const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
    expect(after).toMatch(/- first/)
  })
})
