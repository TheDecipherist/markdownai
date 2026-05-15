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
