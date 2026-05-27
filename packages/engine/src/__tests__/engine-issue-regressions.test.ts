import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'

// ISSUE-002/003 — @query with allowShell: true works inside @define/@call
describe('ISSUE-003 — @query inside @define/@call with allowShell enabled', () => {
  it('@query in macro body executes and populates label accessible to caller /', () => {
    const src = '@markdownai\n@define q_macro\n@query "echo hello" label="result" /\n@define-end\n@call q_macro /\n@if {{ result }} == "hello"\nresult works\n@if-end\n'
    const ast = parse(src)
    const result = execute(ast, { ctx: { security: { allowShell: true, allowHttp: false, allowDb: false, jailRoot: null } } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('result works')
  })

  it('@query in macro body with allowShell: false silently strips without warning /', () => {
    const src = '@markdownai\n@define q_macro\n@query "echo hello" label="result" /\n@define-end\n@call q_macro /\n'
    const ast = parse(src)
    const result = execute(ast, { ctx: { security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null } } })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result.output.trim()).toBe('')
  })
})

// ISSUE-005 — @import absolute path should warn, not crash
describe('ISSUE-005 — @import absolute path graceful degradation', () => {
  it('@import with absolute path emits a warning and does not add to errors /', () => {
    const ast = parse('@markdownai\n@import /tmp/nonexistent.md /\n')
    const result = execute(ast)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings.some(w => w.includes('@import') && w.includes('skipped'))).toBe(true)
  })

  it('@import with absolute path allows subsequent nodes to render /', () => {
    const ast = parse('@markdownai\n@import /tmp/nonexistent.md /\n\nOutput here.\n')
    const result = execute(ast)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('Output here')
  })

  it('@import with relative path still works normally /', () => {
    const ast = parse('@markdownai\n# Hello\n')
    const result = execute(ast)
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('# Hello')
  })
})
