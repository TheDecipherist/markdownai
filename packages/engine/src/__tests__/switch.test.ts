import { describe, it, expect } from 'vitest'
import { execute } from '../engine.js'
import type { ParseResult, ASTNode, SwitchNode, ForeachNode } from '@markdownai/parser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const header = { type: 'header' as const, line: 1, version: null }

function md(text: string) {
  return { type: 'markdown' as const, line: 0, text, interpolations: [], shellInlines: [] }
}

function sw(opts: {
  line?: number
  expression: string
  cases: Array<{ caseExpression: string; body: ReturnType<typeof md>[] }>
  defaultBody?: ReturnType<typeof md>[] | null
}): SwitchNode {
  return {
    type: 'switch',
    line: opts.line ?? 2,
    expression: opts.expression,
    cases: opts.cases,
    defaultBody: opts.defaultBody ?? null,
  }
}

function skill(args: string) {
  return {
    skillContext: {
      args,
      argsList: args.trim() ? args.trim().split(/\s+/) : [],
      namedArgs: {} as Record<string, string>,
      sessionId: '',
      effort: '',
      skillDir: '',
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@switch engine execution', () => {
  it('renders the matching @case body', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"hello"',
        cases: [
          { caseExpression: '"hello"', body: [md('matched hello')] },
          { caseExpression: '"world"', body: [md('matched world')] },
        ],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('matched hello')
  })

  it('renders @default body when no case matches', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"other"',
        cases: [{ caseExpression: '"hello"', body: [md('hello branch')] }],
        defaultBody: [md('default branch')],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('default branch')
  })

  it('returns empty string when no case matches and no @default exists', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"nomatch"',
        cases: [{ caseExpression: '"hello"', body: [md('hello branch')] }],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output.trim()).toBe('')
  })

  it('evaluates a {{ }} dynamic expression on the switch value (e.g. argsList[0])', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '{{argsList[0]}}',
        cases: [
          { caseExpression: '"foo"', body: [md('foo branch')] },
          { caseExpression: '"bar"', body: [md('bar branch')] },
        ],
      }) as unknown as ASTNode],
    }
    const result = execute(ast, { ctx: skill('foo') })
    expect(result.output).toBe('foo branch')
  })

  it('evaluates a {{ }} dynamic expression on a @case value (e.g. @case {{ENV_STAGE}})', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"prod"',
        cases: [{ caseExpression: '{{ENV_STAGE}}', body: [md('stage branch')] }],
        defaultBody: [md('default branch')],
      }) as unknown as ASTNode],
    }
    const result = execute(ast, { ctx: { env: { ENV_STAGE: 'prod' }, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('stage branch')
  })

  it('matches string "1" against @case "1" (number value stringified)', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '1',
        cases: [{ caseExpression: '"1"', body: [md('number one')] }],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('number one')
  })

  it('first match wins when multiple cases could match', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"hit"',
        cases: [
          { caseExpression: '"hit"', body: [md('first match')] },
          { caseExpression: '"hit"', body: [md('second match')] },
        ],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('first match')
  })

  it('switch expression uses foreach loop variable when nested inside @foreach', () => {
    const foreachNode: ForeachNode = {
      type: 'foreach',
      line: 2,
      varName: 'item',
      source: null,
      literalSource: 'alpha,beta,gamma',
      args: {},
      body: [sw({
        line: 3,
        expression: '{{item}}',
        cases: [{ caseExpression: '"beta"', body: [md('found beta')] }],
      }) as unknown as ASTNode],
    }
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, foreachNode as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toContain('found beta')
  })

  it('@case "default" matches the string "default", not the @default block', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"default"',
        cases: [{ caseExpression: '"default"', body: [md('case default string')] }],
        defaultBody: [md('structural default')],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('case default string')
    expect(result.output).not.toContain('structural default')
  })

  it("empty expression ('') matches @case \"\"", () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '""',
        cases: [{ caseExpression: '""', body: [md('empty match')] }],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('empty match')
  })

  it('nested @switch inside a matched case body executes correctly', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '"outer"',
        cases: [{
          caseExpression: '"outer"',
          body: [sw({
            line: 4,
            expression: '"inner"',
            cases: [{ caseExpression: '"inner"', body: [md('deep match')] }],
          }) as unknown as ReturnType<typeof md>],
        }],
      }) as unknown as ASTNode],
    }
    const result = execute(ast)
    expect(result.output).toBe('deep match')
  })

  it('unresolvable/undefined expression is treated as empty string', () => {
    const ast: ParseResult = {
      isMarkdownAI: true, version: null,
      nodes: [header, sw({
        expression: '{{UNDEFINED_VAR_XYZ}}',
        cases: [{ caseExpression: '""', body: [md('matched empty')] }],
        defaultBody: [md('default')],
      }) as unknown as ASTNode],
    }
    const result = execute(ast, { ctx: { env: {}, envFiles: {}, envFallbacks: {} } })
    expect(result.output).toBe('matched empty')
  })
})
