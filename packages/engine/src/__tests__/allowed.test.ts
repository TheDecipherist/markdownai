import { describe, it, expect } from 'vitest'
import { evalExpression, evalCondition } from '../conditions.js'
import { evalExpr } from '../engine-interpolate.js'
import { makeContext } from '../context.js'
import type { EngineContext } from '../context.js'

function makeCtx(argsList: string[] = []): EngineContext {
  const ctx = makeContext({ env: {}, cwd: '/tmp' })
  ctx.skillContext = {
    args: argsList.join(' '),
    argsList,
    namedArgs: {},
    sessionId: '',
    effort: 'medium',
    skillDir: '/tmp',
  }
  return ctx
}

describe('allowed() in evalExpression (conditions sandbox)', () => {
  it('returns the value when it is in the array allow-list', () => {
    expect(evalExpression('allowed("audit", ["audit","build","op"])', makeCtx())).toBe('audit')
  })

  it('returns false when the value is not in the array allow-list', () => {
    expect(evalExpression('allowed("invalid", ["audit","build","op"])', makeCtx())).toBe('false')
  })

  it('the || default pattern triggers when value is not allowed', () => {
    expect(evalExpression('allowed("invalid", ["audit","build","op"]) || "build"', makeCtx())).toBe('build')
  })

  it('the || default pattern does not trigger when value is allowed', () => {
    expect(evalExpression('allowed("audit", ["audit","build","op"]) || "build"', makeCtx())).toBe('audit')
  })

  it('accepts a single string as the allow-list (normalises to array)', () => {
    expect(evalExpression('allowed("audit", "audit")', makeCtx())).toBe('audit')
    expect(evalExpression('allowed("build", "audit") || "fallback"', makeCtx())).toBe('fallback')
  })

  it('returns false for bad second argument: null', () => {
    expect(evalExpression('allowed("x", null) || "safe"', makeCtx())).toBe('safe')
  })

  it('returns false for bad second argument: number', () => {
    expect(evalExpression('allowed("x", 42) || "safe"', makeCtx())).toBe('safe')
  })

  it('falls back to default when argsList[0] is undefined on empty list', () => {
    expect(evalExpression('allowed(argsList[0], ["audit","build"]) || "build"', makeCtx([]))).toBe('build')
  })
})

describe('allowed() with argsList in conditions sandbox', () => {
  it('allows argsList[0] when it is in the list', () => {
    const ctx = makeCtx(['audit'])
    expect(evalExpression('allowed(argsList[0], ["audit","build","op"]) || "build"', ctx)).toBe('audit')
  })

  it('falls back to default when argsList[0] is not in the list', () => {
    const ctx = makeCtx(['invalid'])
    expect(evalExpression('allowed(argsList[0], ["audit","build","op"]) || "build"', ctx)).toBe('build')
  })

  it('falls back to default when argsList is empty', () => {
    const ctx = makeCtx([])
    expect(evalExpression('allowed(argsList[0], ["audit","build","op"]) || "build"', ctx)).toBe('build')
  })
})

describe('allowed() case-insensitive option', () => {
  it('matches case-insensitively when ignoreCase is true', () => {
    expect(evalExpression('allowed("AUDIT", ["audit","build"], {ignoreCase:true})', makeCtx())).toBe('AUDIT')
  })

  it('preserves original casing in the return value', () => {
    expect(evalExpression('allowed("Audit", ["audit"], {ignoreCase:true})', makeCtx())).toBe('Audit')
  })

  it('is case-sensitive by default', () => {
    expect(evalExpression('allowed("AUDIT", ["audit"]) || "none"', makeCtx())).toBe('none')
  })
})

describe('allowed() in evalCondition', () => {
  it('is truthy in a condition when value is allowed', () => {
    expect(evalCondition('allowed("audit", ["audit","build"])', makeCtx())).toBe(true)
  })

  it('is falsy in a condition when value is not allowed', () => {
    expect(evalCondition('allowed("invalid", ["audit","build"])', makeCtx())).toBe(false)
  })
})

describe('allowed() in evalExpr (interpolation sandbox)', () => {
  it('resolves in {{ }} interpolation context', () => {
    const ctx = makeCtx(['build'])
    expect(evalExpr('allowed(argsList[0], ["audit","build","op"]) || "audit"', ctx)).toBe('build')
  })

  it('falls back in {{ }} interpolation when not in list', () => {
    const ctx = makeCtx(['unknown'])
    expect(evalExpr('allowed(argsList[0], ["audit","build","op"]) || "audit"', ctx)).toBe('audit')
  })
})
