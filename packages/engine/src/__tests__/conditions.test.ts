import { describe, it, expect, beforeEach } from 'vitest'
import { evalCondition, evalExpression } from '../conditions.js'
import type { EngineContext } from '../context.js'
import { makeContext } from '../context.js'
import { tmpdir } from 'node:os'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

function makeCtx(env: Record<string, string> = {}, docDir = '/tmp'): EngineContext {
  const ctx = makeContext({ env, cwd: docDir })
  ctx.docDir = docDir
  return ctx
}

describe('evalCondition', () => {
  it('evaluates true literal', () => {
    expect(evalCondition('true', makeCtx())).toBe(true)
  })

  it('evaluates false literal', () => {
    expect(evalCondition('false', makeCtx())).toBe(false)
  })

  it('evaluates env var equality', () => {
    const ctx = makeCtx({ NODE_ENV: 'production' })
    expect(evalCondition('NODE_ENV === "production"', ctx)).toBe(true)
    expect(evalCondition('NODE_ENV === "development"', ctx)).toBe(false)
  })

  it('accesses env.VAR_NAME for unsafe key names', () => {
    const ctx = makeCtx({ 'my-var': 'hello' })
    expect(evalCondition('env["my-var"] === "hello"', ctx)).toBe(true)
  })

  it('evaluates numeric comparison', () => {
    const ctx = makeCtx({ COUNT: '5' })
    expect(evalCondition('Number(COUNT) > 3', ctx)).toBe(true)
  })

  it('returns false and warns on invalid expression', () => {
    const ctx = makeCtx()
    const result = evalCondition('!!!@@@###', ctx)
    expect(result).toBe(false)
    expect(ctx.warnings.length).toBeGreaterThan(0)
  })

  it('respects 500ms timeout (fast expression completes)', () => {
    const ctx = makeCtx()
    expect(() => evalCondition('1 + 1', ctx)).not.toThrow()
  })
})

describe('evalExpression', () => {
  it('returns empty string for falsy', () => {
    const ctx = makeCtx()
    expect(evalExpression('undefined', ctx)).toBe('')
  })

  it('returns string result', () => {
    const ctx = makeCtx({ NAME: 'Alice' })
    expect(evalExpression('NAME', ctx)).toBe('Alice')
  })

  it('evaluates string concatenation', () => {
    const ctx = makeCtx({ FIRST: 'Hello', LAST: 'World' })
    expect(evalExpression('FIRST + " " + LAST', ctx)).toBe('Hello World')
  })

  it('returns empty string and warns on error', () => {
    const ctx = makeCtx()
    const result = evalExpression('throw new Error("boom")', ctx)
    expect(result).toBe('')
    expect(ctx.warnings.some(w => w.includes('Unresolvable'))).toBe(true)
  })
})

describe('file.* helpers confinement', () => {
  let tmp: string

  beforeEach(() => {
    tmp = join(tmpdir(), `cond-test-${Date.now()}`)
    mkdirSync(tmp, { recursive: true })
    writeFileSync(join(tmp, 'allowed.txt'), 'content')
  })

  it('file.exists returns true for confined path', () => {
    const ctx = makeCtx({}, tmp)
    ctx.security.jailRoot = tmp
    expect(evalCondition('file.exists("allowed.txt")', ctx)).toBe(true)
  })

  it('file.exists returns false for path escaping jailRoot', () => {
    const ctx = makeCtx({}, tmp)
    ctx.security.jailRoot = tmp
    expect(evalCondition('file.exists("../../etc/passwd")', ctx)).toBe(false)
  })

  it('file.isFile returns true for a file', () => {
    const ctx = makeCtx({}, tmp)
    ctx.security.jailRoot = tmp
    expect(evalCondition('file.isFile("allowed.txt")', ctx)).toBe(true)
  })

  it('file.isDir returns false for a file', () => {
    const ctx = makeCtx({}, tmp)
    ctx.security.jailRoot = tmp
    expect(evalCondition('file.isDir("allowed.txt")', ctx)).toBe(false)
  })

  it('file.isDir returns false for path escaping jailRoot', () => {
    const ctx = makeCtx({}, tmp)
    ctx.security.jailRoot = tmp
    expect(evalCondition('file.isDir("../../etc")', ctx)).toBe(false)
  })
})
