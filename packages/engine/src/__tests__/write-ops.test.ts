import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

/**
 * Wave 3 — v2.0 write directives: @mkdir, @copy, @append-if-missing.
 *
 * All three share the same security gate (filesystem.write_enabled +
 * write_root + allowed_write_paths + immutable rules).
 */

describe('write directives (Wave 3)', () => {
  let projectDir: string
  let skillDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-write-proj-'))
    skillDir = mkdtempSync(join(tmpdir(), 'mai-write-skill-'))
  })

  afterEach(() => {
    for (const d of [projectDir, skillDir]) {
      try { rmSync(d, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  function makeFsConfig(extras: Partial<{
    write_enabled: boolean
    write_root: string
    allowed_write_paths: string[]
    allowed_data_paths: string[]
    allowed_source_paths: string[]
  }> = {}) {
    return {
      source_root: 'auto',
      data_root: 'cwd',
      allowed_source_paths: extras.allowed_source_paths ?? [],
      allowed_data_paths: extras.allowed_data_paths ?? [],
      write_enabled: extras.write_enabled ?? true,
      write_root: extras.write_root ?? 'cwd',
      allowed_write_paths: extras.allowed_write_paths ?? [],
      additional_block_paths: [],
      additional_block_patterns: [],
      allow_unmasked_paths: [],
      allow_unmasked_patterns: [],
      user_masking_patterns: [],
    }
  }

  function render(content: string, opts: { cwd: string; filesystemConfig?: ReturnType<typeof makeFsConfig> } = { cwd: '' }) {
    const filePath = join(skillDir, 'doc.md')
    writeFileSync(filePath, content, 'utf8')
    const ast = parse(content, { filePath })
    return execute(ast, {
      filePath,
      ctx: {
        cwd: opts.cwd,
        security: {
          allowShell: false, allowHttp: false, allowDb: false,
          jailRoot: null,
          filesystemConfig: opts.filesystemConfig ?? makeFsConfig(),
        },
      },
    })
  }

  describe('@mkdir /', () => {
    it('creates a directory inside the write root', () => {
      render(
        `@markdownai v1.0\n@mkdir .mdd/docs /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(existsSync(join(projectDir, '.mdd/docs'))).toBe(true)
    })

    it('creates nested directories with recursive=true (default)', () => {
      render(
        `@markdownai v1.0\n@mkdir .mdd/audits/2026 /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(existsSync(join(projectDir, '.mdd/audits/2026'))).toBe(true)
    })

    it('blocked when write_enabled is false', () => {
      const result = render(
        `@markdownai v1.0\n@mkdir .mdd /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: false }) },
      )
      expect(existsSync(join(projectDir, '.mdd'))).toBe(false)
      expect(result.warnings.join('\n')).toMatch(/write is disabled/i)
    })

    it('blocked when path is outside write root', () => {
      const result = render(
        `@markdownai v1.0\n@mkdir ../escape /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(result.warnings.join('\n')).toMatch(/blocked|outside/i)
    })

    it('uses path= named arg', () => {
      render(
        `@markdownai v1.0\n@mkdir path=".mdd/jobs" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(existsSync(join(projectDir, '.mdd/jobs'))).toBe(true)
    })
  })

  describe('@copy /', () => {
    it('copies a source file to a destination inside the write root', () => {
      const src = join(skillDir, 'template.md')
      writeFileSync(src, 'template content', 'utf8')
      render(
        `@markdownai v1.0\n@copy from="${src}" to=".mdd/file.md" /\n`,
        {
          cwd: projectDir,
          filesystemConfig: makeFsConfig({
            write_enabled: true,
            allowed_data_paths: [`${skillDir}/**`],
          }),
        },
      )
      expect(readFileSync(join(projectDir, '.mdd/file.md'), 'utf8')).toBe('template content')
    })

    it('if-missing flag preserves existing file content', () => {
      mkdirSync(join(projectDir, '.mdd'), { recursive: true })
      writeFileSync(join(projectDir, '.mdd/file.md'), 'existing content', 'utf8')
      const src = join(skillDir, 'template.md')
      writeFileSync(src, 'template content', 'utf8')
      render(
        `@markdownai v1.0\n@copy from="${src}" to=".mdd/file.md" if-missing /\n`,
        {
          cwd: projectDir,
          filesystemConfig: makeFsConfig({
            write_enabled: true,
            allowed_data_paths: [`${skillDir}/**`],
          }),
        },
      )
      expect(readFileSync(join(projectDir, '.mdd/file.md'), 'utf8')).toBe('existing content')
    })

    it('expands ${CLAUDE_SKILL_DIR} in from path', () => {
      writeFileSync(join(skillDir, 'tpl.md'), 'from-expansion', 'utf8')
      const content = `@markdownai v1.0\n@copy from="\${CLAUDE_SKILL_DIR}/tpl.md" to=".mdd/x.md" /\n`
      const filePath = join(skillDir, 'doc.md')
      writeFileSync(filePath, content, 'utf8')
      const ast = parse(content, { filePath })
      execute(ast, {
        filePath,
        ctx: {
          cwd: projectDir,
          skillContext: { args: '', argsList: [], namedArgs: {}, sessionId: '', effort: '', skillDir },
          security: {
            allowShell: false, allowHttp: false, allowDb: false,
            jailRoot: null,
            filesystemConfig: makeFsConfig({
              write_enabled: true,
              allowed_data_paths: ['${CLAUDE_SKILL_DIR}/**'],
            }),
          },
        },
      })
      expect(readFileSync(join(projectDir, '.mdd/x.md'), 'utf8')).toBe('from-expansion')
    })

    it('blocked when destination is .env (immutable rule)', () => {
      const src = join(skillDir, 'tpl.md')
      writeFileSync(src, 'should not copy', 'utf8')
      const result = render(
        `@markdownai v1.0\n@copy from="${src}" to=".env" /\n`,
        {
          cwd: projectDir,
          filesystemConfig: makeFsConfig({
            write_enabled: true,
            allowed_data_paths: [`${skillDir}/**`],
          }),
        },
      )
      expect(existsSync(join(projectDir, '.env'))).toBe(false)
      expect(result.warnings.join('\n')).toMatch(/blocked/i)
    })

    it('blocked when write_enabled is false', () => {
      const src = join(skillDir, 'tpl.md')
      writeFileSync(src, 'should not copy', 'utf8')
      const result = render(
        `@markdownai v1.0\n@copy from="${src}" to=".mdd/x.md" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: false }) },
      )
      expect(existsSync(join(projectDir, '.mdd/x.md'))).toBe(false)
      expect(result.warnings.join('\n')).toMatch(/write is disabled/i)
    })
  })

  describe('@update-frontmatter /', () => {
    it('replaces an existing frontmatter field value', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '---\nid: 01-test\nstatus: draft\ntitle: Test\n---\n\nBody content.\n', 'utf8')
      render(
        `@markdownai v1.0\n@update-frontmatter path="doc.md" field="status" value="complete" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
      expect(after).toContain('status: complete')
      expect(after).not.toContain('status: draft')
      expect(after).toContain('Body content.')
    })

    it('idempotent: no write when value is unchanged', () => {
      const original = '---\nid: 01-test\nstatus: complete\n---\n\nBody.\n'
      writeFileSync(join(projectDir, 'doc.md'), original, 'utf8')
      render(
        `@markdownai v1.0\n@update-frontmatter path="doc.md" field="status" value="complete" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(readFileSync(join(projectDir, 'doc.md'), 'utf8')).toBe(original)
    })

    it('appends the field if absent in the frontmatter', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '---\nid: 01-test\ntitle: Test\n---\n\nBody.\n', 'utf8')
      render(
        `@markdownai v1.0\n@update-frontmatter path="doc.md" field="status" value="complete" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      const after = readFileSync(join(projectDir, 'doc.md'), 'utf8')
      expect(after).toContain('status: complete')
      expect(after).toContain('id: 01-test')
      expect(after).toContain('title: Test')
    })

    it('refuses to write a file with no frontmatter block', () => {
      writeFileSync(join(projectDir, 'doc.md'), 'No frontmatter here.\n', 'utf8')
      const result = render(
        `@markdownai v1.0\n@update-frontmatter path="doc.md" field="status" value="complete" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(readFileSync(join(projectDir, 'doc.md'), 'utf8')).toBe('No frontmatter here.\n')
      expect(result.warnings.join('\n')).toMatch(/no YAML frontmatter/i)
    })

    it('blocked when target is .env (immutable rule)', () => {
      writeFileSync(join(projectDir, '.env'),
        '---\nSECRET: abc\n---\n', 'utf8')
      const result = render(
        `@markdownai v1.0\n@update-frontmatter path=".env" field="SECRET" value="xyz" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(readFileSync(join(projectDir, '.env'), 'utf8')).toContain('SECRET: abc')
      expect(result.warnings.join('\n')).toMatch(/blocked/i)
    })

    it('blocked when write_enabled is false', () => {
      writeFileSync(join(projectDir, 'doc.md'),
        '---\nstatus: draft\n---\n', 'utf8')
      const result = render(
        `@markdownai v1.0\n@update-frontmatter path="doc.md" field="status" value="complete" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: false }) },
      )
      expect(readFileSync(join(projectDir, 'doc.md'), 'utf8')).toContain('status: draft')
      expect(result.warnings.join('\n')).toMatch(/write is disabled/i)
    })
  })

  describe('@append-if-missing /', () => {
    it('appends text when not already present', () => {
      writeFileSync(join(projectDir, '.gitignore'), 'node_modules/\n', 'utf8')
      render(
        `@markdownai v1.0\n@append-if-missing path=".gitignore" text=".mdd/audits/" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      const after = readFileSync(join(projectDir, '.gitignore'), 'utf8')
      expect(after).toContain('node_modules/')
      expect(after).toContain('.mdd/audits/')
    })

    it('idempotent: does not duplicate existing text', () => {
      writeFileSync(join(projectDir, '.gitignore'), 'node_modules/\n.mdd/audits/\n', 'utf8')
      render(
        `@markdownai v1.0\n@append-if-missing path=".gitignore" text=".mdd/audits/" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      const after = readFileSync(join(projectDir, '.gitignore'), 'utf8')
      const occurrences = (after.match(/\.mdd\/audits\//g) ?? []).length
      expect(occurrences).toBe(1)
    })

    it('no-op when target file does not exist', () => {
      const result = render(
        `@markdownai v1.0\n@append-if-missing path=".gitignore" text=".mdd/" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(existsSync(join(projectDir, '.gitignore'))).toBe(false)
      expect(result.warnings.join('\n')).toMatch(/does not exist/i)
    })

    it('blocked when target is .env', () => {
      writeFileSync(join(projectDir, '.env'), 'PORT=3000\n', 'utf8')
      const result = render(
        `@markdownai v1.0\n@append-if-missing path=".env" text="NEW_VAR=value" /\n`,
        { cwd: projectDir, filesystemConfig: makeFsConfig({ write_enabled: true }) },
      )
      expect(readFileSync(join(projectDir, '.env'), 'utf8')).toBe('PORT=3000\n')
      expect(result.warnings.join('\n')).toMatch(/blocked/i)
    })
  })
})
