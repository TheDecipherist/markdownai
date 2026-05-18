import { describe, it, expect } from 'vitest'
import { evalCondition } from '../conditions.js'
import type { EngineContext } from '../context.js'
import { makeContext } from '../context.js'

function makeCtx(env: Record<string, string> = {}, docDir = '/tmp'): EngineContext {
  const ctx = makeContext({ env, cwd: docDir })
  ctx.docDir = docDir
  return ctx
}

describe('{{ }} interpolation in conditions', () => {
  it('expands {{ envVar }} before evaluating', () => {
    const ctx = makeCtx({ MY_VAR: 'hello' })
    expect(evalCondition('{{ MY_VAR }} === "hello"', ctx)).toBe(true)
  })

  it('expands {{ envFiles label }} — query label stored in envFiles', () => {
    const ctx = makeCtx()
    ctx.envFiles['doc_count'] = '5'
    expect(evalCondition('{{ doc_count }} === "5"', ctx)).toBe(true)
    expect(evalCondition('{{ doc_count }} === "0"', ctx)).toBe(false)
  })

  it('{{ }} resolves to empty string when var unset — condition still evaluates', () => {
    const ctx = makeCtx()
    expect(evalCondition('{{ UNSET_VAR }} === ""', ctx)).toBe(true)
  })

  it('{{ }} works with != operator', () => {
    const ctx = makeCtx()
    ctx.envFiles['stale_job'] = '.mdd/jobs/audit-2026/MANIFEST.md'
    expect(evalCondition('{{ stale_job }} !== ""', ctx)).toBe(true)
  })

  it('{{ }} works in compound conditions', () => {
    const ctx = makeCtx()
    ctx.envFiles['doc_count'] = '0'
    expect(evalCondition('{{ doc_count }} === "0" || {{ doc_count }} === "1"', ctx)).toBe(true)
  })

  it('nested expression in {{ }} is evaluated', () => {
    const ctx = makeCtx({ NODE_ENV: 'production' })
    expect(evalCondition('{{ NODE_ENV === "production" ? "yes" : "no" }} === "yes"', ctx)).toBe(true)
  })
})

describe('match operator', () => {
  it('matches env var against a regex pattern', () => {
    const ctx = makeCtx({ BRANCH: 'feat/my-feature' })
    expect(evalCondition('BRANCH match "^feat"', ctx)).toBe(true)
    expect(evalCondition('BRANCH match "^fix"', ctx)).toBe(false)
  })

  it('works with dotted env path', () => {
    const ctx = makeCtx({ BRANCH: 'main' })
    expect(evalCondition('env.BRANCH match "^main$"', ctx)).toBe(true)
    expect(evalCondition('env.BRANCH match "^feat"', ctx)).toBe(false)
  })

  it('works with {{ }} expanded values', () => {
    const ctx = makeCtx()
    ctx.envFiles['current_branch'] = 'feat/auth'
    expect(evalCondition('{{ current_branch }} match "^feat"', ctx)).toBe(true)
    expect(evalCondition('{{ current_branch }} match "^main"', ctx)).toBe(false)
  })

  it('supports regex special chars like \\d and anchors', () => {
    const ctx = makeCtx({ VERSION: 'v1.2.3' })
    expect(evalCondition('VERSION match "^v\\d"', ctx)).toBe(true)
    expect(evalCondition('VERSION match "^\\d"', ctx)).toBe(false)
  })

  it('can be negated with !()', () => {
    const ctx = makeCtx({ BRANCH: 'main' })
    expect(evalCondition('!(BRANCH match "^feat")', ctx)).toBe(true)
    expect(evalCondition('!(BRANCH match "^main")', ctx)).toBe(false)
  })

  it('can be combined with && and ||', () => {
    const ctx = makeCtx({ BRANCH: 'feat/auth', NODE_ENV: 'development' })
    expect(evalCondition('BRANCH match "^feat" && NODE_ENV === "development"', ctx)).toBe(true)
    expect(evalCondition('BRANCH match "^fix" || BRANCH match "^feat"', ctx)).toBe(true)
    expect(evalCondition('BRANCH match "^fix" || BRANCH match "^chore"', ctx)).toBe(false)
  })

  it('handles single-quoted pattern', () => {
    const ctx = makeCtx({ BRANCH: 'fix/typo' })
    expect(evalCondition("BRANCH match '^fix'", ctx)).toBe(true)
    expect(evalCondition("BRANCH match '^feat'", ctx)).toBe(false)
  })

  it('unset var match returns false without throwing', () => {
    const ctx = makeCtx()
    expect(evalCondition('{{ UNSET }} match "^feat"', ctx)).toBe(false)
  })
})

// ISSUE-004 — undefined label in @if treated as empty string, no warning
describe('ISSUE-004 — @if with undefined label emits no warning', () => {
  it('{{ undefined_label }} in @if equality check evaluates to false without adding a warning', () => {
    const ctx = makeCtx()
    const result = evalCondition('{{ doc_count }} == "0"', ctx)
    expect(result).toBe(false)
    expect(ctx.warnings).toHaveLength(0)
  })

  it('{{ undefined_label }} in @if does not add to ctx.warnings', () => {
    const ctx = makeCtx()
    evalCondition('{{ completely_undefined }} == "hello"', ctx)
    expect(ctx.warnings).toHaveLength(0)
  })

  it('syntax error in @if expression still emits a warning (ReferenceError is silent, others are not)', () => {
    const ctx = makeCtx()
    evalCondition('!!!@@@###', ctx)
    expect(ctx.warnings.length).toBeGreaterThan(0)
  })

  it('label set to empty string in envFiles produces no warning in @if', () => {
    const ctx = makeCtx()
    ctx.envFiles['doc_count'] = ''
    const result = evalCondition('{{ doc_count }} == "0"', ctx)
    expect(result).toBe(false)
    expect(ctx.warnings).toHaveLength(0)
  })
})
