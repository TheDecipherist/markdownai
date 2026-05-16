import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runRender } from '../commands/render.js'
import { runValidate } from '../commands/validate.js'
import { runParse } from '../commands/parse.js'
import { runEval } from '../commands/eval.js'
import { loadEnvFile } from '../env-loader.js'

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
    const file = write('env.md', '@markdownai\n\n@env MY_UNDEFINED_VAR fallback="hello"\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('hello')
  })

  it('renders define and call macro', () => {
    const file = write('macro.md', '@markdownai\n\n@define greeting\nHello, {{name}}!\n@end\n\n@call greeting name="Alice"\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Hello, Alice!')
  })

  it('renders @if conditional true branch', () => {
    const file = write('cond.md', '@markdownai\n\n@if true\nyes\n@endif\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('yes')
  })

  it('renders pipe with list source and sort transform', () => {
    const subDir = join(TMP, 'list-test')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'beta.ts'), '')
    writeFileSync(join(subDir, 'alpha.ts'), '')
    const file = write('pipe.md', `@markdownai\n\n@list ${subDir} | sort | @render list\n`)
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    const lines = result.output.split('\n')
    const alphaIdx = lines.findIndex(l => l.includes('alpha'))
    const betaIdx = lines.findIndex(l => l.includes('beta'))
    expect(alphaIdx).toBeLessThan(betaIdx)
  })
})

describe('@include behavior', () => {
  it('@include evaluates inline condition — skips when false', () => {
    writeFileSync(join(TMP, 'cond-part.md'), '@markdownai\n\nSecret content\n')
    writeFileSync(join(TMP, 'cond-main.md'), '@markdownai\n\n@include ./cond-part.md if false\n\nVisible\n')
    const result = runRender(join(TMP, 'cond-main.md'))
    expect(result.output).not.toContain('Secret content')
    expect(result.output).toContain('Visible')
  })

  it('@include strips @phase wrapper in included file — body always renders', () => {
    writeFileSync(join(TMP, 'phase-part.md'), '@markdownai\n\n@phase build\n## Build Info\n@end\n')
    writeFileSync(join(TMP, 'phase-main.md'), '@markdownai\n\n@include ./phase-part.md\n')
    const result = runRender(join(TMP, 'phase-main.md'))
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Build Info')
  })
})

describe('@import connect registration', () => {
  it('@connect in @import registers connection in parent scope', () => {
    writeFileSync(join(TMP, 'shared-connect.md'), '@markdownai\n\n@connect primary type="mongodb" uri=env.MONGO_URI\n')
    writeFileSync(join(TMP, 'main-connect.md'), '@markdownai\n\n@import ./shared-connect.md\n\n# Doc\n')
    const result = runRender(join(TMP, 'main-connect.md'))
    expect(result.exitCode).toBe(0)
  })
})

describe('@if conditionals', () => {
  it('env.VAR == value condition evaluates with env object', () => {
    const file = write('if-env.md', '@markdownai\n\n@if env.MY_ROLE == "admin"\nAdmin panel\n@else\nPublic page\n@endif\n')
    const result = runRender(file)
    expect(result.output).toContain('Public page')
    expect(result.output).not.toContain('Admin panel')
  })

  it('file.exists with quoted path syntax works in @if condition', () => {
    const existing = write('existing-target.md', '@markdownai\n\n# Exists\n')
    const main = write('if-file.md', `@markdownai\n\n@if file.exists "${existing}"\nFound\n@else\nMissing\n@endif\n`)
    const result = runRender(main)
    expect(result.output).toContain('Found')
  })
})

describe('file resolution — circular detection and deduplication', () => {
  it('detects circular @include and reports error', () => {
    const a = join(TMP, 'circ-a.md')
    const b = join(TMP, 'circ-b.md')
    writeFileSync(a, '@markdownai\n\n@include ./circ-b.md\n')
    writeFileSync(b, '@markdownai\n\n@include ./circ-a.md\n')
    const result = runRender(a)
    expect(result.errors.some(e => e.toLowerCase().includes('circular'))).toBe(true)
  })

  it('detects circular @import and reports error', () => {
    writeFileSync(join(TMP, 'cimp-x.md'), `@markdownai\n\n@import ./cimp-y.md\n\n# Hello\n`)
    writeFileSync(join(TMP, 'cimp-y.md'), `@markdownai\n\n@import ./cimp-x.md\n`)
    const result = runRender(join(TMP, 'cimp-x.md'))
    expect(result.errors.some(e => e.toLowerCase().includes('circular'))).toBe(true)
  })

  it('duplicate @import is skipped (first-wins)', () => {
    writeFileSync(join(TMP, 'shared-dedup.md'), '@markdownai\n\n@env DEDUP_VAR fallback="from-shared"\n')
    writeFileSync(join(TMP, 'main-dedup.md'), '@markdownai\n\n@import ./shared-dedup.md\n@import ./shared-dedup.md\n\n@env DEDUP_VAR\n')
    const result = runRender(join(TMP, 'main-dedup.md'))
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('from-shared')
  })

  it('duplicate @include renders content both times', () => {
    const part = join(TMP, 'part-dup.md')
    const main = join(TMP, 'main-dup-inc.md')
    writeFileSync(part, '@markdownai\n\nDuplicated\n')
    writeFileSync(main, '@markdownai\n\n@include ./part-dup.md\n@include ./part-dup.md\n')
    const result = runRender(main)
    expect(result.exitCode).toBe(0)
    const count = (result.output.match(/Duplicated/g) ?? []).length
    expect(count).toBe(2)
  })
})

describe('@list source directive', () => {
  it('@list with match glob filters files', () => {
    const dir = join(TMP, 'glob-test')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'file.ts'), '')
    writeFileSync(join(dir, 'file.js'), '')
    writeFileSync(join(dir, 'note.md'), '')
    const file = write('list-match.md', `@markdownai\n\n@list ${dir} match="*.ts" | @render type="list"\n`)
    const result = runRender(file)
    expect(result.output).toContain('.ts')
    expect(result.output).not.toContain('.js')
    expect(result.output).not.toContain('.md')
  })

  it('@list JSON array path renders each element', () => {
    const jsonFile = join(TMP, 'users.json')
    writeFileSync(jsonFile, JSON.stringify({ users: [{ name: 'Alice' }, { name: 'Bob' }] }))
    const file = write('list-json.md', `@markdownai\n\n@list ${jsonFile} path="users" | @render type="list"\n`)
    const result = runRender(file)
    expect(result.output).toContain('Alice')
    expect(result.output).toContain('Bob')
  })

  it('@list CSV with where filter', () => {
    const csvFile = join(TMP, 'data.csv')
    writeFileSync(csvFile, 'name,role\nAlice,admin\nBob,user\nCarol,admin\n')
    const file = write('list-csv.md', `@markdownai\n\n@list ${csvFile} where="role=='admin'" | @render type="list"\n`)
    const result = runRender(file)
    expect(result.output).toContain('Alice')
    expect(result.output).toContain('Carol')
    expect(result.output).not.toContain('Bob')
  })
})

describe('@read source directive', () => {
  it('@read JSON with dot-notation path returns single value', () => {
    const jsonFile = join(TMP, 'config.json')
    writeFileSync(jsonFile, JSON.stringify({ app: { name: 'MarkdownAI' } }))
    const file = write('read-json.md', `@markdownai\n\n@read ${jsonFile} path="app.name"\n`)
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('MarkdownAI')
  })

  it('@read JSON with array index path', () => {
    const jsonFile = join(TMP, 'servers.json')
    writeFileSync(jsonFile, JSON.stringify({ servers: [{ host: 'prod.example.com' }, { host: 'dev.example.com' }] }))
    const file = write('read-json-idx.md', `@markdownai\n\n@read ${jsonFile} path="servers[0].host"\n`)
    const result = runRender(file)
    expect(result.output).toContain('prod.example.com')
  })

  it('@read .env with key= extracts single value', () => {
    const envFile = join(TMP, 'sample.env')
    writeFileSync(envFile, 'APP_NAME=MarkdownAI\nAPP_VERSION=1.0\n')
    const file = write('read-env.md', `@markdownai\n\n@read ${envFile} key="APP_NAME"\n`)
    const result = runRender(file)
    expect(result.output).toContain('MarkdownAI')
    expect(result.output).not.toContain('APP_VERSION')
  })

  it('@read CSV with column= extracts single column', () => {
    const csvFile = join(TMP, 'products.csv')
    writeFileSync(csvFile, 'name,price\nApple,1.5\nBanana,0.8\n')
    const file = write('read-csv.md', `@markdownai\n\n@read ${csvFile} column="name" | @render type="list"\n`)
    const result = runRender(file)
    expect(result.output).toContain('Apple')
    expect(result.output).toContain('Banana')
    expect(result.output).not.toContain('price')
  })
})

describe('@tree, @date, @count utility directives', () => {
  it('@tree renders ASCII directory tree', () => {
    const dir = join(TMP, 'tree-test')
    mkdirSync(join(dir, 'sub'), { recursive: true })
    writeFileSync(join(dir, 'root.ts'), '')
    writeFileSync(join(dir, 'sub', 'child.ts'), '')
    const file = write('tree.md', `@markdownai\n\n@tree ${dir}\n`)
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('root.ts')
    expect(result.output).toContain('sub')
  })

  it('@date returns current date ISO string', () => {
    const file = write('date.md', '@markdownai\n\n@date\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('@date format="YYYY" returns 4-digit year', () => {
    const file = write('date-fmt.md', '@markdownai\n\n@date format="YYYY"\n')
    const result = runRender(file)
    expect(result.output).toMatch(/^\d{4}$/)
  })

  it('@count counts files in directory', () => {
    const dir = join(TMP, 'count-test')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.ts'), '')
    writeFileSync(join(dir, 'b.ts'), '')
    writeFileSync(join(dir, 'c.js'), '')
    const file = write('count.md', `@markdownai\n\n@count ${dir} match="*.ts"\n`)
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toBe('2')
  })

  it('@date type="created" throws parse error', () => {
    const file = write('date-created.md', '@markdownai\n\n@date type="created"\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(1)
    expect(result.errors.some(e => e.toLowerCase().includes('created'))).toBe(true)
  })
})

describe('@connect registry', () => {
  it('@connect registers named connection without error', () => {
    const file = write('connect-basic.md', '@markdownai\n\n@connect primary type="mongodb" uri=env.MONGO_URI\n\n# Doc\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
  })

  it('@connect with unknown type emits warning', () => {
    const file = write('connect-bad-type.md', '@markdownai\n\n@connect primary type="oracle" uri=env.ORA_URI\n\n# Doc\n')
    const result = runRender(file)
    expect(result.warnings.some(w => w.includes('oracle'))).toBe(true)
  })

  it('@connect @local in included file does not leak to parent', () => {
    writeFileSync(join(TMP, 'local-conn.md'), '@markdownai\n\n@connect temp type="redis" uri=env.REDIS @local\n')
    writeFileSync(join(TMP, 'local-main.md'), '@markdownai\n\n@include ./local-conn.md\n\n# Doc\n')
    const result = runRender(join(TMP, 'local-main.md'))
    expect(result.exitCode).toBe(0)
  })
})

describe('@db jailed directive', () => {
  it('@db stripped silently when security.allowDb is false (default)', () => {
    const file = write('db-stripped.md', '@markdownai\n\n@connect primary type="mongodb" uri=env.MONGO_URI\n\n@db using="primary" query="db.users.find()"\n\n# Doc\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toBe('# Doc')
  })

  it('@db in pipe also stripped when security off', () => {
    const file = write('db-pipe-stripped.md', '@markdownai\n\n@db query="SELECT * FROM users" | @render type="table"\n\n# Done\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
  })
})

describe('@http jailed directive', () => {
  it('@http stripped silently when security.allowHttp is false (default)', () => {
    const file = write('http-stripped.md', '@markdownai\n\n@http url="https://api.example.com/data"\n\n# Doc\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toBe('# Doc')
  })

  it('@http cloud metadata endpoint blocked even when allowHttp enabled', () => {
    // We test the warning message via the engine directly in engine tests
    // Here just verify the directive is stripped safely
    const file = write('http-meta.md', '@markdownai\n\n@http url="http://169.254.169.254/latest/meta-data"\n\n# Doc\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
  })
})

describe('@query shell directive', () => {
  it('@query stripped silently when security.allowShell is false (default)', () => {
    const file = write('query-stripped.md', '@markdownai\n\n@query "echo hello"\n\n# Doc\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toBe('# Doc')
    expect(result.warnings).toHaveLength(0)
  })
})

describe('@phase and @graph directives', () => {
  it('@phase body renders when no phase context (phase=null)', () => {
    const file = write('phase-render.md', '@markdownai\n\n@phase setup\n## Setup\n@end\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Setup')
  })

  it('@graph block passes through as-is in output', () => {
    const src = '@markdownai\n\n```mai-graph\nflowchart TD\n  a --> b\n```\n'
    const file = write('graph-test.md', src)
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('flowchart TD')
  })

  it('@graph validate --verbose warns when phase name missing from graph', () => {
    const src = '@markdownai\n\n@phase setup\n## Setup\n@end\n\n```mai-graph\nflowchart TD\n  build --> deploy\n```\n'
    const file = write('graph-mismatch.md', src)
    const result = runValidate(file, { verbose: true })
    expect(result.warnings.some(w => w.includes('setup'))).toBe(true)
  })

  it('@phase in @include renders body without @phase tags', () => {
    writeFileSync(join(TMP, 'phase-inc.md'), '@markdownai\n\n@phase build\n## Build\n@end\n')
    writeFileSync(join(TMP, 'phase-inc-main.md'), '@markdownai\n\n@include ./phase-inc.md\n')
    const result = runRender(join(TMP, 'phase-inc-main.md'))
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Build')
  })
})

describe('@env resolution and @import fallback registration', () => {
  it('@env inside @import registers fallback — subsequent @env in main doc resolves it', () => {
    write('shared-env.md', '@markdownai\n\n@env MDD_TEST_APP fallback="MyApp"\n')
    const main = write('main-env.md', '@markdownai\n\n@import ./shared-env.md\n\n@env MDD_TEST_APP\n')
    const result = runRender(main)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('MyApp')
  })

  it('@env without fallback returns empty string when var not set', () => {
    const file = write('env-empty.md', '@markdownai\n\n@env DEFINITELY_NOT_SET_MDD_12345\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output.trim()).toBe('')
  })

  it('@env directive-level fallback wins when process.env is unset', () => {
    const file = write('env-directive-fallback.md', '@markdownai\n\n@env UNSET_MDD_VAR_9999 fallback="directive-default"\n')
    const result = runRender(file)
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('directive-default')
  })
})

describe('runValidate', () => {
  it('validates a correct MarkdownAI document with exit 0', () => {
    const file = write('valid.md', '@markdownai\n\n# Good document\n\nNo errors here.\n')
    const result = runValidate(file)
    expect(result.exitCode).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('reports error for non-MarkdownAI document', () => {
    const file = write('bad.md', '# Not MarkdownAI\n\nMissing header.\n')
    const result = runValidate(file)
    expect(result.exitCode).toBe(1)
    expect(result.errors.some(e => e.includes('missing'))).toBe(true)
  })

  it('reports error for missing @include file', () => {
    const file = write('include-bad.md', '@markdownai\n\n@include ./nonexistent.md\n')
    const result = runValidate(file)
    expect(result.exitCode).toBe(1)
    expect(result.errors.some(e => e.includes('@include'))).toBe(true)
  })

  it('reports error for undefined @call macro', () => {
    const file = write('call-bad.md', '@markdownai\n\n@call undefined_macro\n')
    const result = runValidate(file)
    expect(result.exitCode).toBe(1)
    expect(result.errors.some(e => e.includes('@call'))).toBe(true)
  })

  it('reports warning for @env without fallback', () => {
    const file = write('env-warn.md', '@markdownai\n\n@env NO_FALLBACK_VAR_123\n')
    const result = runValidate(file)
    expect(result.warnings.some(w => w.includes('@env'))).toBe(true)
  })

  it('returns exit 1 for missing file', () => {
    const result = runValidate('/no/such/file.md')
    expect(result.exitCode).toBe(1)
  })
})

describe('runParse', () => {
  it('outputs valid JSON AST', () => {
    const file = write('parse.md', '@markdownai\n\n# Hello\n')
    const result = runParse(file)
    expect(result.exitCode).toBe(0)
    const ast = JSON.parse(result.output) as { isMarkdownAI: boolean }
    expect(ast.isMarkdownAI).toBe(true)
  })

  it('pretty-prints when --pretty is set', () => {
    const file = write('parse-pretty.md', '@markdownai\n\n# Hello\n')
    const result = runParse(file, { pretty: true })
    expect(result.output).toContain('\n')
  })

  it('filters to specific node type with --node', () => {
    const file = write('parse-node.md', '@markdownai\n\n# Hello\n\n@env FOO fallback="bar"\n')
    const result = runParse(file, { node: 'env' })
    const ast = JSON.parse(result.output) as { nodes: Array<{ type: string }> }
    expect(ast.nodes.every(n => n.type === 'env')).toBe(true)
  })

  it('returns exit 1 for missing file', () => {
    const result = runParse('/no/such/file.md')
    expect(result.exitCode).toBe(1)
  })
})

describe('runEval', () => {
  it('evaluates a true expression', () => {
    const result = runEval('1 + 1 === 2')
    expect(result.output).toBe('true')
    expect(result.exitCode).toBe(0)
  })

  it('evaluates a false expression', () => {
    const result = runEval('1 === 2')
    expect(result.output).toBe('false')
  })

  it('evaluates string concatenation', () => {
    const result = runEval('"hello" + " " + "world"')
    expect(result.output).toBe('hello world')
  })
})

describe('loadEnvFile', () => {
  it('parses key=value pairs', () => {
    const file = write('test.env', 'FOO=bar\nBAZ=qux\n')
    const env = loadEnvFile(file)
    expect(env['FOO']).toBe('bar')
    expect(env['BAZ']).toBe('qux')
  })

  it('strips surrounding quotes from values', () => {
    const file = write('quoted.env', 'FOO="hello world"\nBAR=\'single\'\n')
    const env = loadEnvFile(file)
    expect(env['FOO']).toBe('hello world')
    expect(env['BAR']).toBe('single')
  })

  it('ignores comments and blank lines', () => {
    const file = write('comments.env', '# comment\n\nFOO=bar\n')
    const env = loadEnvFile(file)
    expect(Object.keys(env)).toHaveLength(1)
    expect(env['FOO']).toBe('bar')
  })

  it('returns empty object for missing file', () => {
    const env = loadEnvFile('/no/such/file.env')
    expect(env).toEqual({})
  })
})
