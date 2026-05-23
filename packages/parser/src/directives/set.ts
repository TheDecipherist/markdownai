import type { ParseModule, ParseContext, ASTNode, SetNode } from '../types.js'

// @set <var> = <expression-or-directive>
//
// Inline directive that binds <var> to the value of the right-hand side.
// The RHS can be:
//   - a directive invocation starting with `@` (e.g. `@date format="YYYY-MM-DD"`)
//   - a `{{ interpolation }}` or arithmetic expression
//   - a literal string (with or without quotes)
//
// Equivalent to the existing `label=` mechanism on every source directive but
// usable for cases where the RHS isn't a single directive (arithmetic,
// concatenation, literal strings, ternary).
const setDir: ParseModule = {
  name: 'set',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const trimmed = args.trim()
    const eq = trimmed.indexOf('=')
    const varName = eq > 0 ? trimmed.slice(0, eq).trim() : ''
    const rhs = eq > 0 ? trimmed.slice(eq + 1).trim() : ''
    const node: SetNode = {
      type: 'set',
      line: ctx.line,
      varName,
      source: null,
      literalExpr: rhs,
      args: {},
    }
    return node
  },
}

export default setDir
