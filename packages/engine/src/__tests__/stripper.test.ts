import { describe, it, expect } from 'vitest'
import { parse } from '@markdownai/parser'
import { strip } from '../stripper.js'
import { clearSessionCache, clearPersistCache, showCacheEntries, writeCache, cacheKey } from '../cache.js'

describe('strip — node removal rules', () => {
  it('removes @markdownai header', () => {
    const ast = parse('@markdownai\nHello')
    const result = strip(ast)
    expect(result.output).not.toContain('@markdownai')
    expect(result.output).toContain('Hello')
  })

  it('passes through markdown content unchanged', () => {
    const ast = parse('@markdownai\n# Heading\n\nParagraph text.')
    const result = strip(ast)
    expect(result.output).toContain('# Heading')
    expect(result.output).toContain('Paragraph text.')
  })

  it('removes @env directives', () => {
    const ast = parse('@markdownai\n@env MY_VAR default /\nSome text')
    const result = strip(ast)
    expect(result.output).not.toContain('@env')
    expect(result.output).toContain('Some text')
  })

  it('removes @connect directives', () => {
    const ast = parse('@markdownai\n@connect primary type=mongodb uri=env.MONGO /\nSome text')
    const result = strip(ast)
    expect(result.output).not.toContain('@connect')
    expect(result.output).toContain('Some text')
  })

  it('keeps @phase body but removes @phase/@end tags', () => {
    const ast = parse('@markdownai\n@phase setup\nSetup content.\n@phase-end')
    const result = strip(ast)
    expect(result.output).toContain('Setup content.')
    expect(result.output).not.toContain('@phase')
    expect(result.output).not.toContain('@end')
  })

  it('removes @define blocks entirely', () => {
    const ast = parse('@markdownai\n@define greet\nHello!\n@define-end\nAfter')
    const result = strip(ast)
    expect(result.output).not.toContain('@define')
    expect(result.output).not.toContain('@end')
    expect(result.output).toContain('After')
  })

  it('removes @call directives', () => {
    const ast = parse('@markdownai\n@call greet /\nAfter')
    const result = strip(ast)
    expect(result.output).not.toContain('@call')
    expect(result.output).toContain('After')
  })

  it('resolves @if conditional true branch', () => {
    const ast = parse('@markdownai\n@if true\nTrue branch\n@else\nFalse branch\n@if-end')
    const result = strip(ast, { env: {} })
    expect(result.output).toContain('True branch')
    expect(result.output).not.toContain('False branch')
  })

  it('resolves @if with env variable', () => {
    const ast = parse('@markdownai\n@if NODE_ENV === "production"\nProd content\n@else\nDev content\n@if-end')
    const result = strip(ast, { env: { NODE_ENV: 'production' } })
    expect(result.output).toContain('Prod content')
    expect(result.output).not.toContain('Dev content')
  })

  it('@else renders when condition is false', () => {
    const ast = parse('@markdownai\n@if false\nTrue branch\n@else\nFalse branch\n@if-end')
    const result = strip(ast)
    expect(result.output).not.toContain('True branch')
    expect(result.output).toContain('False branch')
  })

  it('removes data directives (list, read, tree, date, count, db, http, query)', () => {
    const ast = parse('@markdownai\n@list ./src /\nAfter')
    const result = strip(ast)
    expect(result.output).not.toContain('@list')
    expect(result.output).toContain('After')
  })

  it('removes pipe chains', () => {
    const ast = parse('@markdownai\n@list ./src | sort | @render type=list /\nAfter')
    const result = strip(ast)
    expect(result.output).not.toContain('@list')
    expect(result.output).toContain('After')
  })

  it('passes through @graph nodes unchanged', () => {
    const ast = parse('@markdownai\n```mai-graph\nA --> B\n```')
    const result = strip(ast)
    // graph raw content is preserved
    expect(result.output.length).toBeGreaterThan(0)
  })

  it('resolves interpolations against env', () => {
    const ast = parse('@markdownai\nHello {{NAME}}!')
    const result = strip(ast, { env: { NAME: 'World' } })
    expect(result.output).toContain('Hello World!')
  })

  it('removes unresolvable interpolations', () => {
    const ast = parse('@markdownai\nHello {{UNSET_VAR}}!')
    const result = strip(ast, { env: {} })
    expect(result.output).toContain('Hello !')
  })

  it('warns about unset variables in @if conditions', () => {
    const ast = parse('@markdownai\n@if UNSET_VAR === "x"\nbranch\n@if-end')
    const result = strip(ast, { env: {} })
    expect(result.warnings.some(w => w.includes('UNSET_VAR'))).toBe(true)
  })

  it('returns error for non-MarkdownAI document', () => {
    const ast = parse('# Regular markdown')
    const result = strip(ast)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('cache management', () => {
  it('clearSessionCache clears in-memory entries', () => {
    const key = cacheKey('test', { id: 'session-test' })
    writeCache(key, 'test-value', { mode: 'session' })
    clearSessionCache()
    const entries = showCacheEntries('session')
    expect(entries.length).toBe(0)
  })

  it('showCacheEntries returns session entries', () => {
    clearSessionCache()
    const key = cacheKey('list', { path: './test' })
    writeCache(key, 'value', { mode: 'session' })
    const entries = showCacheEntries('session')
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0]?.mode).toBe('session')
    clearSessionCache()
  })

  it('showCacheEntries returns both when no mode specified', () => {
    clearSessionCache()
    const key = cacheKey('env', { name: 'test-all' })
    writeCache(key, 'v', { mode: 'session' })
    const entries = showCacheEntries()
    const sessionEntries = entries.filter(e => e.mode === 'session')
    expect(sessionEntries.length).toBeGreaterThan(0)
    clearSessionCache()
  })

  it('clearPersistCache does not throw when cache dir absent', () => {
    expect(() => clearPersistCache()).not.toThrow()
  })
})
