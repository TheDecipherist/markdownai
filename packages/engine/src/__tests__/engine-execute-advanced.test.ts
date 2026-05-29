import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import type { ParseResult } from '@markdownai/parser'

const header = { type: 'header' as const, line: 1, version: null, shellInline: null }

describe('execute — macro params and positional call args', () => {
  it('expands macro with positional args via @define name(param) syntax', () => {
    const ast = parse('@markdownai\n@define greet(name)\nHello, {{name}}!\n@define-end\n\n@call greet(World) /')
    const result = execute(ast)
    expect(result.output).toBe('Hello, World!')
  })

  it('expands macro with named paren args', () => {
    const ast = parse('@markdownai\n@define row(title, value)\n{{title}}: {{value}}\n@define-end\n\n@call row(title=Foo, value=Bar) /')
    const result = execute(ast)
    expect(result.output).toBe('Foo: Bar')
  })

  it('unspecified param resolves to empty string', () => {
    const ast = parse('@markdownai\n@define greet(name)\nHello, {{name}}!\n@define-end\n\n@call greet() /')
    const result = execute(ast)
    expect(result.output).toBe('Hello, !')
  })
})

describe('execute — @http security', () => {
  it('@http cloud metadata endpoint always blocked even with allowHttp /', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, { type: 'http', line: 2, args: { url: 'http://169.254.169.254/latest/meta-data' }, cache: null }],
    }
    const result = execute(ast, { ctx: { security: { allowShell: false, allowHttp: true, allowDb: false, jailRoot: null } } })
    expect(result.warnings.some(w => w.includes('SECURITY_ALERT'))).toBe(true)
    expect(result.output.trim()).toBe('')
  })

  it('@http stripped silently when allowHttp is false /', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, { type: 'http', line: 2, args: { url: 'https://api.example.com' }, cache: null }],
    }
    const result = execute(ast)
    expect(result.output.trim()).toBe('')
    expect(result.warnings).toHaveLength(0)
  })
})

describe('execute — interpolation evaluation', () => {
  it('resolves env.VAR via env object in sandbox', () => {
    const ast = parse('@markdownai\nHello {{ env.USER_NAME }}!')
    const result = execute(ast, { ctx: { env: { USER_NAME: 'Alice' }, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('Hello Alice!')
  })

  it('resolves env.VAR with nullish coalescing', () => {
    const ast = parse('@markdownai\n{{ env.MISSING_VAR ?? "fallback" }}')
    const result = execute(ast, { ctx: { env: {}, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('fallback')
  })

  it('resolves ternary expression', () => {
    const ast = parse('@markdownai\n{{ env.MODE == "prod" ? "production" : "dev" }}')
    const result = execute(ast, { ctx: { env: { MODE: 'prod' }, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('production')
  })

  it('resolves date format="YYYY" to current year', () => {
    const ast = parse('@markdownai\nYear: {{ date format="YYYY" }}')
    const result = execute(ast)
    expect(result.output).toContain(String(new Date().getFullYear()))
  })

  it('unresolvable reference (ReferenceError) returns empty silently', () => {
    // Updated 2026-05-25: ReferenceError on a fully undefined identifier
    // (`totally`) is now suppressed in the warnings array. Multi-phase
    // document renders walk every phase, and phases that don't apply to
    // the current invocation legitimately reference variables set by
    // other phases. The warning per undefined ref floods the output
    // with noise that's already implied by the missing content.
    // Errors are still captured to ~/.markdownai/logs/markdownai-error.log
    // for audit.
    const ast = parse('@markdownai\n{{ totally.undefined.thing }}')
    const result = execute(ast, { ctx: { env: {}, envFiles: {}, envFallbacks: {} } })
    expect(result.output.trim()).toBe('')
    expect(result.warnings.some(w => w.includes('totally'))).toBe(false)
  })

  it('non-Reference error in expression still warns (TypeError, SyntaxError, etc.)', () => {
    // null.method() throws TypeError, not ReferenceError — that's a real
    // expression bug (not a phase-context issue) and should still surface
    // in the warnings array so authors notice.
    const ast = parse('@markdownai\n{{ (null).method() }}')
    const result = execute(ast, { ctx: { env: {}, envFiles: {}, envFallbacks: {} } })
    expect(result.output.trim()).toBe('')
    expect(result.warnings.some(w => w.includes('null'))).toBe(true)
  })

  it('escaped \\{{ renders as literal {{ }}', () => {
    const ast = parse('@markdownai\nUse \\{{ env.NAME }} in config')
    const result = execute(ast)
    expect(result.output).toContain('{{env.NAME}}')
  })
})

describe('execute — version pin warnings', () => {
  const header = { type: 'header' as const, line: 1, version: null, shellInline: null }

  it('returns no warnings when version pin matches installed version', () => {
    const ast: ParseResult = { isMarkdownAI: true, version: '1.0', nodes: [header] }
    const result = execute(ast)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns no warnings when no version pin present', () => {
    const ast: ParseResult = { isMarkdownAI: true, version: null, nodes: [header] }
    const result = execute(ast)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns warning when document requires newer minor version', () => {
    const ast: ParseResult = { isMarkdownAI: true, version: '1.9', nodes: [header] }
    const result = execute(ast)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/v1\.9/)
  })

  it('returns warning when document requires newer major version', () => {
    const ast: ParseResult = { isMarkdownAI: true, version: '2.0', nodes: [header] }
    const result = execute(ast)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/v2\.0/)
  })

  it('returns no warning when document requires older version', () => {
    const ast: ParseResult = { isMarkdownAI: true, version: '0.9', nodes: [header] }
    const result = execute(ast)
    expect(result.warnings).toHaveLength(0)
  })

  it('result always has a warnings array', () => {
    const ast: ParseResult = { isMarkdownAI: false, version: null, nodes: [] }
    const result = execute(ast)
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})
