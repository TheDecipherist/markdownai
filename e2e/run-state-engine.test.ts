import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function dist(pkg: string, entry = 'index.js'): string {
  return join(ROOT, 'packages', pkg, 'dist', entry)
}

// ─── execute ─────────────────────────────────────────────────────────────────

describe('@markdownai/engine — execute', () => {
  it('dist/index.js resolves and exports execute()', async () => {
    const mod = await import(dist('engine'))
    expect(typeof mod.execute).toBe('function')
  })

  it('execute() returns an EngineResult with output string', async () => {
    const { parse } = await import(dist('parser'))
    const { execute } = await import(dist('engine'))
    const ast = parse('@markdownai v1.0\n\n# Test\n\nHello')
    const result = execute(ast)
    expect(typeof result.output).toBe('string')
    expect(Array.isArray(result.errors)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('execute() does not throw on a minimal document', async () => {
    const { parse } = await import(dist('parser'))
    const { execute } = await import(dist('engine'))
    const ast = parse('@markdownai v1.0\n\nHello')
    expect(() => execute(ast)).not.toThrow()
  })
})

// ─── strip ───────────────────────────────────────────────────────────────────

describe('@markdownai/engine — strip', () => {
  it('dist/index.js exports strip()', async () => {
    const mod = await import(dist('engine'))
    expect(typeof mod.strip).toBe('function')
  })

  it('strip() returns StripResult with output string', async () => {
    const { parse } = await import(dist('parser'))
    const { strip } = await import(dist('engine'))
    const ast = parse('@markdownai v1.0\n\nHello world')
    const result = strip(ast)
    expect(typeof result.output).toBe('string')
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})

// ─── makeContext / resolveEnv ─────────────────────────────────────────────────

describe('@markdownai/engine — makeContext / resolveEnv', () => {
  it('dist/index.js exports makeContext()', async () => {
    const mod = await import(dist('engine'))
    expect(typeof mod.makeContext).toBe('function')
  })

  it('makeContext() returns a context object', async () => {
    const { makeContext } = await import(dist('engine'))
    const ctx = makeContext()
    expect(ctx).toBeDefined()
    expect(typeof ctx.env).toBe('object')
    expect(ctx.env).not.toBeNull()
  })

  it('resolveEnv() resolves a known env var', async () => {
    const { makeContext, resolveEnv } = await import(dist('engine'))
    const ctx = makeContext()
    const value = resolveEnv('PATH', null, ctx)
    expect(typeof value).toBe('string')
    expect(value.length).toBeGreaterThan(0)
  })
})

// ─── evalCondition / evalExpression ──────────────────────────────────────────

describe('@markdownai/engine — evalCondition / evalExpression', () => {
  it('evalCondition() returns true for a truthy expression', async () => {
    const { makeContext, evalCondition } = await import(dist('engine'))
    const ctx = makeContext()
    expect(evalCondition('true', ctx)).toBe(true)
  })

  it('evalExpression() returns string result', async () => {
    const { makeContext, evalExpression } = await import(dist('engine'))
    const ctx = makeContext()
    expect(evalExpression("'hello'", ctx)).toBe('hello')
  })
})

// ─── isBuiltin / runBuiltin ───────────────────────────────────────────────────

describe('@markdownai/engine — isBuiltin / runBuiltin', () => {
  it('isBuiltin() returns true for grep', async () => {
    const { isBuiltin } = await import(dist('engine'))
    expect(isBuiltin('grep')).toBe(true)
  })

  it('isBuiltin() returns false for unknown command', async () => {
    const { isBuiltin } = await import(dist('engine'))
    expect(isBuiltin('notacommand')).toBe(false)
  })

  it('runBuiltin() filters lines with grep', async () => {
    const { runBuiltin } = await import(dist('engine'))
    const lines = ['hello world', 'foo bar', 'hello again']
    const result = runBuiltin('grep hello', lines)
    expect(Array.isArray(result)).toBe(true)
    expect(result.every((l: string) => l.includes('hello'))).toBe(true)
  })
})

// ─── cache ────────────────────────────────────────────────────────────────────

describe('@markdownai/engine — cache', () => {
  it('cacheKey() returns a deterministic string', async () => {
    const { cacheKey } = await import(dist('engine'))
    const key1 = cacheKey('env', { key: 'HOME' })
    const key2 = cacheKey('env', { key: 'HOME' })
    expect(typeof key1).toBe('string')
    expect(key1.length).toBeGreaterThan(0)
    expect(key1).toBe(key2)
  })

  it('clearSessionCache() does not throw', async () => {
    const { clearSessionCache } = await import(dist('engine'))
    expect(() => clearSessionCache()).not.toThrow()
  })

  it('showCacheEntries() returns an array', async () => {
    const { showCacheEntries } = await import(dist('engine'))
    const entries = showCacheEntries()
    expect(Array.isArray(entries)).toBe(true)
  })
})

// ─── security — filesystem ────────────────────────────────────────────────────

describe('@markdownai/engine — security: filesystem', () => {
  it('checkFilePath() returns allowed for a safe path', async () => {
    const { checkFilePath } = await import(dist('engine'))
    const result = checkFilePath('docs/test.md', '/home/user/project')
    expect(result.level).toBe('allowed')
  })

  it('checkFilePath() returns blocked for /etc/passwd', async () => {
    const { checkFilePath } = await import(dist('engine'))
    const result = checkFilePath('/etc/passwd', '/home/user/project')
    expect(result.level).toBe('blocked')
  })
})

// ─── security — masking ───────────────────────────────────────────────────────

describe('@markdownai/engine — security: masking', () => {
  it('applyMasking() masks AWS_SECRET_ACCESS_KEY pattern', async () => {
    const { applyMasking } = await import(dist('engine'))
    const result = applyMasking('AWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE')
    expect(result.wasMasked).toBe(true)
    expect(result.masked).not.toContain('AKIAIOSFODNN7EXAMPLE')
  })

  it('applyMasking() does not mask plain text', async () => {
    const { applyMasking } = await import(dist('engine'))
    const result = applyMasking('Hello, world!')
    expect(result.wasMasked).toBe(false)
    expect(result.masked).toBe('Hello, world!')
  })
})

// ─── security — shell ─────────────────────────────────────────────────────────

describe('@markdownai/engine — security: shell', () => {
  it('checkShellCommand() allows echo', async () => {
    const { checkShellCommand } = await import(dist('engine'))
    const config = { enabled: true, allow_patterns: ['echo *'], deny_patterns: [] }
    const result = checkShellCommand('echo hello', config)
    expect(result.allowed).toBe(true)
  })

  it('checkShellCommand() blocks rm -rf /', async () => {
    const { checkShellCommand } = await import(dist('engine'))
    const config = { enabled: true, allow_patterns: ['*'], deny_patterns: [] }
    const result = checkShellCommand('rm -rf /', config)
    expect(result.allowed).toBe(false)
  })
})

// ─── security — rules ─────────────────────────────────────────────────────────

describe('@markdownai/engine — security: rules', () => {
  it('FILESYSTEM_ALWAYS_BLOCK_PATHS is a non-empty frozen array', async () => {
    const { FILESYSTEM_ALWAYS_BLOCK_PATHS } = await import(dist('engine'))
    expect(Array.isArray(FILESYSTEM_ALWAYS_BLOCK_PATHS)).toBe(true)
    expect(FILESYSTEM_ALWAYS_BLOCK_PATHS.length).toBeGreaterThan(0)
    expect(Object.isFrozen(FILESYSTEM_ALWAYS_BLOCK_PATHS)).toBe(true)
  })

  it('matchGlob() matches wildcard patterns', async () => {
    const { matchGlob } = await import(dist('engine'))
    expect(matchGlob('*.md', 'test.md')).toBe(true)
    expect(matchGlob('*.md', 'test.ts')).toBe(false)
  })
})
