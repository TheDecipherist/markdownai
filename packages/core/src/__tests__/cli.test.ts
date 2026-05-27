import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRender } from '../commands/render.js'

const TMP = join(tmpdir(), 'markdownai-cli-test')

beforeAll(() => { mkdirSync(TMP, { recursive: true }) })
afterAll(() => { rmSync(TMP, { recursive: true, force: true }) })

function write(name: string, content: string): string {
  const p = join(TMP, name)
  writeFileSync(p, content)
  return p
}

describe('runRender', () => {
  it('renders a simple MarkdownAI document', () => {
    const file = write('simple.md', '@markdownai\n\n# Hello\n\nWorld\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('# Hello')
    expect(result.output).toContain('World')
  })

  it('returns exit 1 for missing file', () => {
    const result = runRender('/nonexistent/path/file.md')
    expect(result.exitCode).toBe(1)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns error output for non-MarkdownAI document', () => {
    const file = write('plain.md', '# Just markdown\n\nNo directives.\n')
    const result = runRender(file)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('renders @env with fallback', () => {
    const file = write('env.md', '@markdownai\n\n@env MY_UNDEFINED_VAR fallback="hello" /\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('hello')
  })

  it('renders define and call macro', () => {
    const file = write('macro.md', '@markdownai\n\n@define greeting\nHello, {{name}}!\n@define-end\n\n@call greeting name="Alice" /\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Hello, Alice!')
  })

  it('renders @if conditional true branch', () => {
    const file = write('cond.md', '@markdownai\n\n@if true\nyes\n@if-end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('yes')
  })

  it('renders pipe with list source and sort transform', () => {
    const subDir = join(TMP, 'list-test')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'beta.ts'), '')
    writeFileSync(join(subDir, 'alpha.ts'), '')
    const file = write('pipe.md', `@markdownai\n\n@list ./list-test | sort | @render list /\n`)
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    const lines = result.output.split('\n')
    const alphaIdx = lines.findIndex(l => l.includes('alpha'))
    const betaIdx = lines.findIndex(l => l.includes('beta'))
    expect(alphaIdx).toBeLessThan(betaIdx)
  })
})

describe('@include behavior /', () => {
  it('@include evaluates inline condition — skips when false /', () => {
    writeFileSync(join(TMP, 'cond-part.md'), '@markdownai\n\nSecret content\n')
    writeFileSync(join(TMP, 'cond-main.md'), '@markdownai\n\n@include ./cond-part.md if false /\n\nVisible\n')
    const result = runRender(join(TMP, 'cond-main.md'))
    expect(result.output).not.toContain('Secret content')
    expect(result.output).toContain('Visible')
  })

  it('@include strips @phase wrapper in included file — body always renders /', () => {
    writeFileSync(join(TMP, 'phase-part.md'), '@markdownai\n\n@phase build\n## Build Info\n@phase-end\n')
    writeFileSync(join(TMP, 'phase-main.md'), '@markdownai\n\n@include ./phase-part.md /\n')
    const result = runRender(join(TMP, 'phase-main.md'))
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Build Info')
  })
})

describe('@import connect registration /', () => {
  it('@connect in @import registers connection in parent scope /', () => {
    writeFileSync(join(TMP, 'shared-connect.md'), '@markdownai\n\n@connect primary type="mongodb" uri=env.MONGO_URI /\n')
    writeFileSync(join(TMP, 'main-connect.md'), '@markdownai\n\n@import ./shared-connect.md /\n\n# Doc\n')
    const result = runRender(join(TMP, 'main-connect.md'))
    expect(result.exitCode).toBe(0)
  })
})

describe('@if conditionals', () => {
  it('env.VAR == value condition evaluates with env object', () => {
    const file = write('if-env.md', '@markdownai\n\n@if env.MY_ROLE == "admin"\nAdmin panel\n@else\nPublic page\n@if-end\n')
    const result = runRender(file)
    expect(result.output).toContain('Public page')
    expect(result.output).not.toContain('Admin panel')
  })

  it('file.exists with quoted path syntax works in @if condition', () => {
    const existing = write('existing-target.md', '@markdownai\n\n# Exists\n')
    const main = write('if-file.md', `@markdownai\n\n@if file.exists "${existing}"\nFound\n@else\nMissing\n@if-end\n`)
    const result = runRender(main)
    expect(result.output).toContain('Found')
  })
})

describe('file resolution — circular detection and deduplication', () => {
  it('detects circular @include and reports error', () => {
    const a = join(TMP, 'circ-a.md')
    const b = join(TMP, 'circ-b.md')
    writeFileSync(a, '@markdownai\n\n@include ./circ-b.md /\n')
    writeFileSync(b, '@markdownai\n\n@include ./circ-a.md /\n')
    const result = runRender(a)
    expect(result.errors.some(e => e.toLowerCase().includes('circular'))).toBe(true)
  })

  it('detects circular @import and reports error', () => {
    writeFileSync(join(TMP, 'cimp-x.md'), `@markdownai\n\n@import ./cimp-y.md /\n\n# Hello\n`)
    writeFileSync(join(TMP, 'cimp-y.md'), `@markdownai\n\n@import ./cimp-x.md /\n`)
    const result = runRender(join(TMP, 'cimp-x.md'))
    expect(result.errors.some(e => e.toLowerCase().includes('circular'))).toBe(true)
  })

  it('duplicate @import is skipped (first-wins)', () => {
    writeFileSync(join(TMP, 'shared-dedup.md'), '@markdownai\n\n@env DEDUP_VAR fallback="from-shared" /\n')
    writeFileSync(join(TMP, 'main-dedup.md'), '@markdownai\n\n@import ./shared-dedup.md /\n@import ./shared-dedup.md /\n\n@env DEDUP_VAR /\n')
    const result = runRender(join(TMP, 'main-dedup.md'))
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('from-shared')
  })

  it('duplicate @include renders content both times', () => {
    const part = join(TMP, 'part-dup.md')
    const main = join(TMP, 'main-dup-inc.md')
    writeFileSync(part, '@markdownai\n\nDuplicated\n')
    writeFileSync(main, '@markdownai\n\n@include ./part-dup.md /\n@include ./part-dup.md /\n')
    const result = runRender(main)
    expect(result.exitCode).toBe(0)
    const count = (result.output.match(/Duplicated/g) ?? []).length
    expect(count).toBe(2)
  })
})

describe('@list source directive /', () => {
  it('@list with match glob filters files /', () => {
    const dir = join(TMP, 'glob-test')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'file.ts'), '')
    writeFileSync(join(dir, 'file.js'), '')
    writeFileSync(join(dir, 'note.md'), '')
    const file = write('list-match.md', `@markdownai\n\n@list ./glob-test match="*.ts" | @render type="list" /\n`)
    const result = runRender(file)
    expect(result.output).toContain('.ts')
    expect(result.output).not.toContain('.js')
    expect(result.output).not.toContain('.md')
  })

  it('@list JSON array path renders each element /', () => {
    const jsonFile = join(TMP, 'users.json')
    writeFileSync(jsonFile, JSON.stringify({ users: [{ name: 'Alice' }, { name: 'Bob' }] }))
    const file = write('list-json.md', `@markdownai\n\n@list ./users.json path="users" | @render type="list" /\n`)
    const result = runRender(file)
    expect(result.output).toContain('Alice')
    expect(result.output).toContain('Bob')
  })

  it('@list CSV with where filter /', () => {
    const csvFile = join(TMP, 'data.csv')
    writeFileSync(csvFile, 'name,role\nAlice,admin\nBob,user\nCarol,admin\n')
    const file = write('list-csv.md', `@markdownai\n\n@list ./data.csv where="role=='admin'" | @render type="list" /\n`)
    const result = runRender(file)
    expect(result.output).toContain('Alice')
    expect(result.output).toContain('Carol')
    expect(result.output).not.toContain('Bob')
  })
})
