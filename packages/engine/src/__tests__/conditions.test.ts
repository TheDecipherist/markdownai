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

describe('skill context variables', () => {
  function makeSkillCtx(args: string, opts: { sessionId?: string; effort?: string; skillDir?: string; namedArgs?: Record<string, string> } = {}): EngineContext {
    const ctx = makeCtx()
    const argsList = args.trim().length > 0
      ? [...args.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '')
      : []
    ctx.skillContext = {
      args,
      argsList,
      namedArgs: opts.namedArgs ?? {},
      sessionId: opts.sessionId ?? '',
      effort: opts.effort ?? '',
      skillDir: opts.skillDir ?? '',
    }
    return ctx
  }

  it('ARGUMENTS equals the raw args string', () => {
    expect(evalCondition('ARGUMENTS === "audit"', makeSkillCtx('audit'))).toBe(true)
  })

  it('args shorthand equals ARGUMENTS', () => {
    expect(evalCondition('args === "audit"', makeSkillCtx('audit'))).toBe(true)
  })

  it('ARGUMENTS.startsWith works for dispatch', () => {
    expect(evalCondition('ARGUMENTS.startsWith("audit")', makeSkillCtx('audit section-1'))).toBe(true)
    expect(evalCondition('ARGUMENTS.startsWith("audit")', makeSkillCtx('build my feature'))).toBe(false)
  })

  it('$ARGUMENTS preprocessed to ARGUMENTS', () => {
    expect(evalCondition('$ARGUMENTS === "status"', makeSkillCtx('status'))).toBe(true)
  })

  it('argsList[0] gives first positional arg', () => {
    expect(evalCondition('argsList[0] === "audit"', makeSkillCtx('audit wave-1'))).toBe(true)
    expect(evalCondition('argsList[1] === "wave-1"', makeSkillCtx('audit wave-1'))).toBe(true)
  })

  it('$ARGUMENTS[N] preprocessed to argsList[N]', () => {
    expect(evalCondition('$ARGUMENTS[0] === "plan-wave"', makeSkillCtx('plan-wave auth-wave-1'))).toBe(true)
  })

  it('$N shorthand preprocessed to argsList[N]', () => {
    expect(evalCondition('$0 === "ops"', makeSkillCtx('ops deploy swarmk'))).toBe(true)
    expect(evalCondition('$1 === "deploy"', makeSkillCtx('ops deploy swarmk'))).toBe(true)
  })

  it('arg0/arg1/arg2 shortcuts work', () => {
    expect(evalCondition('arg0 === "update"', makeSkillCtx('update 04'))).toBe(true)
    expect(evalCondition('arg1 === "04"', makeSkillCtx('update 04'))).toBe(true)
  })

  it('handles quoted args in argsList', () => {
    const ctx = makeSkillCtx('"hello world" second')
    expect(evalCondition('argsList[0] === "hello world"', ctx)).toBe(true)
    expect(evalCondition('argsList[1] === "second"', ctx)).toBe(true)
  })

  it('empty ARGUMENTS', () => {
    expect(evalCondition('ARGUMENTS === ""', makeSkillCtx(''))).toBe(true)
  })

  it('CLAUDE_EFFORT is accessible', () => {
    expect(evalCondition('CLAUDE_EFFORT === "high"', makeSkillCtx('', { effort: 'high' }))).toBe(true)
  })

  it('CLAUDE_SESSION_ID is accessible', () => {
    const ctx = makeSkillCtx('', { sessionId: 'abc123' })
    expect(evalCondition('CLAUDE_SESSION_ID === "abc123"', ctx)).toBe(true)
  })

  it('CLAUDE_SKILL_DIR is accessible', () => {
    const ctx = makeSkillCtx('', { skillDir: '/home/user/.claude/commands' })
    expect(evalCondition('CLAUDE_SKILL_DIR.includes("commands")', ctx)).toBe(true)
  })

  it('named args spread into root scope', () => {
    const ctx = makeSkillCtx('', { namedArgs: { issue: '42', branch: 'feat/auth' } })
    expect(evalCondition('issue === "42"', ctx)).toBe(true)
    expect(evalCondition('branch === "feat/auth"', ctx)).toBe(true)
  })

  it('skillContext null — all skill vars default to empty string', () => {
    const ctx = makeCtx()
    ctx.skillContext = null
    expect(evalCondition('ARGUMENTS === ""', ctx)).toBe(true)
    expect(evalCondition('CLAUDE_EFFORT === ""', ctx)).toBe(true)
  })
})
