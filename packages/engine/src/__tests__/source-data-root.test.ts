import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

/**
 * Wave 1 — v2.0 source vs data root split.
 *
 * Source ops (@import, @include) jail to source_root (default: dirname of entry doc).
 * Data ops (@list, @read, @tree, @count, file.*) jail to data_root (default: cwd).
 */

describe('source vs data root split (v2.0)', () => {
  let projectDir: string
  let skillDir: string

  beforeEach(() => {
    // Two separate temp dirs:
    //   skillDir   — where the entry document lives (a "skill file")
    //   projectDir — process cwd at render time (the user's project)
    projectDir = mkdtempSync(join(tmpdir(), 'maitest-proj-'))
    skillDir = mkdtempSync(join(tmpdir(), 'maitest-skill-'))
  })

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }) } catch { /* ignore */ }
    try { rmSync(skillDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  function render(content: string, opts?: { cwd?: string; filePath?: string }) {
    const filePath = opts?.filePath ?? join(skillDir, 'doc.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    const cwd = opts?.cwd ?? process.cwd()
    return execute(ast, { filePath, ctx: { cwd } })
  }

  it('data ops resolve relative to cwd, not document directory (DEFAULT v2.0 BEHAVIOR)', () => {
    // Set up: project has .mdd/docs/test.md; skill doc lives elsewhere
    mkdirSync(join(projectDir, '.mdd/docs'), { recursive: true })
    writeFileSync(join(projectDir, '.mdd/docs/test.md'), 'project content', 'utf8')

    const result = render(
      `@markdownai v1.0\n@list ./.mdd/docs/ match="*.md" type=files\n`,
      { cwd: projectDir },
    )
    expect(result.output).toContain('test.md')
  })

  it('source ops still resolve relative to document directory', () => {
    // skill_dir has a sibling lib file; @import should find it
    writeFileSync(join(skillDir, 'lib.md'), '@markdownai v1.0\n@define hello\nlibrary loaded\n@end\n', 'utf8')

    const result = render(
      `@markdownai v1.0\n@import ./lib.md\n@call hello\n`,
      { cwd: projectDir },
    )
    expect(result.output).toContain('library loaded')
  })

  it('file.isFile uses data root (cwd) not document dir', () => {
    writeFileSync(join(projectDir, 'marker.txt'), 'present', 'utf8')

    const result = render(
      `@markdownai v1.0\n@if file.isFile("marker.txt")\nFOUND\n@endif\n`,
      { cwd: projectDir },
    )
    expect(result.output).toContain('FOUND')
  })

  it('file.isDir uses data root', () => {
    mkdirSync(join(projectDir, '.mdd/docs'), { recursive: true })

    const result = render(
      `@markdownai v1.0\n@if file.isDir(".mdd/docs")\nDIR EXISTS\n@endif\n`,
      { cwd: projectDir },
    )
    expect(result.output).toContain('DIR EXISTS')
  })

  it('file.exists uses data root', () => {
    writeFileSync(join(projectDir, 'thing.json'), '{}', 'utf8')

    const result = render(
      `@markdownai v1.0\n@if file.exists("thing.json")\nEXISTS\n@endif\n`,
      { cwd: projectDir },
    )
    expect(result.output).toContain('EXISTS')
  })

  it('@read accesses files relative to cwd by default', () => {
    writeFileSync(join(projectDir, 'data.json'), JSON.stringify({ version: '2.0.0' }), 'utf8')

    const result = render(
      `@markdownai v1.0\n@read ./data.json path="version"\n`,
      { cwd: projectDir },
    )
    expect(result.output).toContain('2.0.0')
  })

  it('paths above data root are blocked (path traversal)', () => {
    const result = render(
      `@markdownai v1.0\n@read ../../../etc/passwd\n`,
      { cwd: projectDir },
    )
    expect(result.output).not.toContain('root:')
    expect(result.warnings.join('\n')).toMatch(/blocked|outside/i)
  })

  it('always-block patterns trump everything (immutable rules)', () => {
    writeFileSync(join(projectDir, '.env'), 'SECRET=abc', 'utf8')

    const result = render(
      `@markdownai v1.0\n@read ./.env key="SECRET"\n`,
      { cwd: projectDir },
    )
    expect(result.output).not.toContain('abc')
    expect(result.warnings.join('\n')).toMatch(/blocked/i)
  })
})

describe('allowed_data_paths and allowed_source_paths', () => {
  let projectDir: string
  let extraDir: string
  let skillDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'maitest-proj-'))
    extraDir = mkdtempSync(join(tmpdir(), 'maitest-extra-'))
    skillDir = mkdtempSync(join(tmpdir(), 'maitest-skill-'))
  })

  afterEach(() => {
    for (const d of [projectDir, extraDir, skillDir]) {
      try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  function makeFilesystemConfig(extras: { allowed_data_paths?: string[]; allowed_source_paths?: string[] }) {
    return {
      source_root: 'auto',
      data_root: 'cwd',
      allowed_source_paths: extras.allowed_source_paths ?? [],
      allowed_data_paths: extras.allowed_data_paths ?? [],
      additional_block_paths: [],
      additional_block_patterns: [],
      allow_unmasked_paths: [],
      allow_unmasked_patterns: [],
      user_masking_patterns: [],
    }
  }

  it('allowed_data_paths lets @read reach files outside cwd', () => {
    writeFileSync(join(extraDir, 'shared.txt'), 'extra content', 'utf8')
    const filePath = join(skillDir, 'doc.md')
    const content = `@markdownai v1.0\n@read ${join(extraDir, 'shared.txt')}\n`
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })

    const result = execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          filesystemConfig: makeFilesystemConfig({
            allowed_data_paths: [`${extraDir}/**`],
          }),
        },
      },
    })
    expect(result.output).toContain('extra content')
  })

  it('${VAR} expansion in allowed_data_paths uses env at check time', () => {
    writeFileSync(join(extraDir, 'shared.txt'), 'env-resolved', 'utf8')
    const filePath = join(skillDir, 'doc.md')
    const content = `@markdownai v1.0\n@read ${join(extraDir, 'shared.txt')}\n`
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })

    const result = execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        envFiles: { TEST_EXTRA_DIR: extraDir },
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          filesystemConfig: makeFilesystemConfig({
            allowed_data_paths: ['${TEST_EXTRA_DIR}/**'],
          }),
        },
      },
    })
    expect(result.output).toContain('env-resolved')
  })

  it('paths outside cwd are blocked when no allowlist matches', () => {
    writeFileSync(join(extraDir, 'shared.txt'), 'should not appear', 'utf8')
    const filePath = join(skillDir, 'doc.md')
    const content = `@markdownai v1.0\n@read ${join(extraDir, 'shared.txt')}\n`
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })

    const result = execute(ast, {
      filePath,
      ctx: {
        cwd: projectDir,
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          filesystemConfig: makeFilesystemConfig({}),
        },
      },
    })
    expect(result.output).not.toContain('should not appear')
    expect(result.warnings.join('\n')).toMatch(/blocked|outside/i)
  })
})

describe('data_root = "auto" preserves v1.x behavior', () => {
  let docDir: string
  let cwd: string

  beforeEach(() => {
    docDir = mkdtempSync(join(tmpdir(), 'maitest-doc-'))
    cwd = mkdtempSync(join(tmpdir(), 'maitest-cwd-'))
  })

  afterEach(() => {
    for (const d of [docDir, cwd]) {
      try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('when data_root="auto", @read jails to document dir, not cwd', () => {
    writeFileSync(join(docDir, 'mine.txt'), 'from doc dir', 'utf8')
    writeFileSync(join(cwd, 'mine.txt'), 'from cwd', 'utf8')
    const filePath = join(docDir, 'doc.md')
    const content = `@markdownai v1.0\n@read ./mine.txt\n`
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })

    const result = execute(ast, {
      filePath,
      ctx: {
        cwd,
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          filesystemConfig: {
            source_root: 'auto',
            data_root: 'auto', // legacy mode
            allowed_source_paths: [],
            allowed_data_paths: [],
            additional_block_paths: [],
            additional_block_patterns: [],
            allow_unmasked_paths: [],
            allow_unmasked_patterns: [],
            user_masking_patterns: [],
          },
        },
      },
    })
    expect(result.output).toContain('from doc dir')
    expect(result.output).not.toContain('from cwd')
  })
})
