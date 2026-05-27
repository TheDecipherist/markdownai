import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@render-template', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-rt-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function makeFsConfig(extras: Partial<{
    write_enabled: boolean
  }> = {}) {
    return {
      source_root: 'auto',
      data_root: 'cwd',
      allowed_source_paths: [],
      allowed_data_paths: [],
      write_enabled: extras.write_enabled ?? true,
      write_root: 'cwd',
      allowed_write_paths: [],
      additional_block_paths: [],
      additional_block_patterns: [],
      allow_unmasked_paths: [],
      allow_unmasked_patterns: [],
      user_masking_patterns: [],
    }
  }

  function render(content: string, fs = makeFsConfig()) {
    const filePath = join(projectDir, 'main.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null, filesystemConfig: fs },
      },
    })
  }

  it('substitutes simple {{ key }} placeholders', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.md'),
      `@markdownai v1.0
# {{ name }}

Status: {{ status }}
`, 'utf8')
    render(
      `@markdownai v1.0
@render-template from="tpl/feature.md" to="out/feature.md"
  name=user-auth
  status=draft
@render-template-end
`,
    )
    const out = readFileSync(join(projectDir, 'out/feature.md'), 'utf8')
    expect(out).toContain('# user-auth')
    expect(out).toContain('Status: draft')
  })

  it('honors @if conditionals on parameter values', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.md'),
      `@markdownai v1.0
@if {{ kind }} == "cli"
  CLI feature.
@if-end
@if {{ kind }} == "web"
  Web feature.
@if-end
`, 'utf8')
    render(
      `@markdownai v1.0
@render-template from="tpl/feature.md" to="out/a.md"
  kind=cli
@render-template-end
@render-template from="tpl/feature.md" to="out/b.md"
  kind=web
@render-template-end
`,
    )
    expect(readFileSync(join(projectDir, 'out/a.md'), 'utf8')).toMatch(/CLI feature/)
    expect(readFileSync(join(projectDir, 'out/a.md'), 'utf8')).not.toMatch(/Web feature/)
    expect(readFileSync(join(projectDir, 'out/b.md'), 'utf8')).toMatch(/Web feature/)
    expect(readFileSync(join(projectDir, 'out/b.md'), 'utf8')).not.toMatch(/CLI feature/)
  })

  it('idempotent: skips when destination already exists', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    mkdirSync(join(projectDir, 'out'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.md'),
      `@markdownai v1.0\nHello {{ name }}\n`, 'utf8')
    writeFileSync(join(projectDir, 'out/feature.md'), 'EXISTING\n', 'utf8')
    render(
      `@markdownai v1.0
@render-template from="tpl/feature.md" to="out/feature.md"
  name=Alice
@render-template-end
`,
    )
    expect(readFileSync(join(projectDir, 'out/feature.md'), 'utf8')).toBe('EXISTING\n')
  })

  it('force overwrites existing destination', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    mkdirSync(join(projectDir, 'out'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.md'),
      `@markdownai v1.0\nHello {{ name }}\n`, 'utf8')
    writeFileSync(join(projectDir, 'out/feature.md'), 'EXISTING\n', 'utf8')
    render(
      `@markdownai v1.0
@render-template from="tpl/feature.md" to="out/feature.md" force
  name=Alice
@render-template-end
`,
    )
    expect(readFileSync(join(projectDir, 'out/feature.md'), 'utf8')).toContain('Hello Alice')
  })

  it('renders plain-text (non-MarkdownAI) templates with simple substitution', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.ts.template'),
      `export const NAME = "{{ name }}";\n`, 'utf8')
    render(
      `@markdownai v1.0
@render-template from="tpl/feature.ts.template" to="src/feature.ts"
  name=auth
@render-template-end
`,
    )
    expect(readFileSync(join(projectDir, 'src/feature.ts'), 'utf8')).toContain('export const NAME = "auth";')
  })

  it('blocked when filesystem.write_enabled=false', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.md'),
      `@markdownai v1.0\n{{ x }}\n`, 'utf8')
    const result = render(
      `@markdownai v1.0
@render-template from="tpl/feature.md" to="out/feature.md"
  x=hi
@render-template-end
`,
      makeFsConfig({ write_enabled: false }),
    )
    expect(existsSync(join(projectDir, 'out/feature.md'))).toBe(false)
    expect(result.warnings.join('\n')).toMatch(/write is disabled/i)
  })

  it('creates parent directories of the destination', () => {
    mkdirSync(join(projectDir, 'tpl'), { recursive: true })
    writeFileSync(join(projectDir, 'tpl/feature.md'),
      `@markdownai v1.0\nout\n`, 'utf8')
    render(
      `@markdownai v1.0
@render-template from="tpl/feature.md" to="deep/nested/path/out.md"
@render-template-end
`,
    )
    expect(existsSync(join(projectDir, 'deep/nested/path/out.md'))).toBe(true)
  })

  it('warns when template source does not exist', () => {
    const result = render(
      `@markdownai v1.0
@render-template from="missing.md" to="out.md"
  x=1
@render-template-end
`,
    )
    expect(result.warnings.join('\n')).toMatch(/does not exist/i)
  })
})
