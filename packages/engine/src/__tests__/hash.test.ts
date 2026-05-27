import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '../engine.js'

describe('@hash', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mai-hash-'))
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

  it('computes sha256 of a file', () => {
    const body = '---\nstatus: complete\n---\n\nHello.\n'
    writeFileSync(join(projectDir, 'doc.md'), body, 'utf8')
    const expected = createHash('sha256').update(body).digest('hex')
    const result = render(
      `@markdownai v1.0
@hash path="doc.md" label=h /
{{ h }}
`,
    )
    expect(result.output).toContain(expected)
  })

  it('truncates to length=', () => {
    const body = 'short\n'
    writeFileSync(join(projectDir, 'doc.md'), body, 'utf8')
    const full = createHash('sha256').update(body).digest('hex')
    const result = render(
      `@markdownai v1.0
@hash path="doc.md" length=8 label=h /
{{ h }}
`,
    )
    expect(result.output).toContain(full.slice(0, 8))
    expect(result.output).not.toContain(full)
  })

  it('exclude-line strips matching lines before hashing', () => {
    // Self-referencing pattern: a doc whose hash: field is computed over the
    // remaining content. Two different files with different hash: lines but
    // identical bodies must produce the same hash.
    const v1 = '---\nhash: aaaaaaaa\nstatus: draft\n---\n\nBody.\n'
    const v2 = '---\nhash: zzzzzzzz\nstatus: draft\n---\n\nBody.\n'
    writeFileSync(join(projectDir, 'a.md'), v1, 'utf8')
    writeFileSync(join(projectDir, 'b.md'), v2, 'utf8')
    const ra = render(
      `@markdownai v1.0\n@hash path="a.md" exclude-line="^hash:" length=8 label=h /\n{{ h }}\n`,
    )
    const rb = render(
      `@markdownai v1.0\n@hash path="b.md" exclude-line="^hash:" length=8 label=h /\n{{ h }}\n`,
    )
    const aHash = ra.output.trim().split('\n').pop()!.trim()
    const bHash = rb.output.trim().split('\n').pop()!.trim()
    expect(aHash).toBe(bHash)
    expect(aHash.length).toBe(8)
  })

  it('warns on unsupported algo', () => {
    writeFileSync(join(projectDir, 'doc.md'), 'x', 'utf8')
    const result = render(
      `@markdownai v1.0\n@hash path="doc.md" algo=zzzzz label=h /\n`,
    )
    expect(result.warnings.join('\n')).toMatch(/unsupported algo/i)
  })

  it('warns when file does not exist', () => {
    const result = render(
      `@markdownai v1.0\n@hash path="missing.md" label=h /\n`,
    )
    expect(result.warnings.join('\n')).toMatch(/does not exist/i)
  })

  it('supports md5 and sha1 algos', () => {
    const body = 'hello\n'
    writeFileSync(join(projectDir, 'doc.md'), body, 'utf8')
    const md5 = createHash('md5').update(body).digest('hex')
    const result = render(
      `@markdownai v1.0\n@hash path="doc.md" algo=md5 label=h /\n{{ h }}\n`,
    )
    expect(result.output).toContain(md5)
  })
})
