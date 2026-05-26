import type { ParseModule, ParseContext, DirectiveInput, ASTNode, SetNode } from '../types.js'

// @set <var> = <expression-or-directive>
//
// rawArgs carries the `varName = expression` text from the opener line.
const setDir: ParseModule = {
  name: 'set',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const trimmed = input.rawArgs.trim()
    const eq = trimmed.indexOf('=')
    const varName = eq > 0 ? trimmed.slice(0, eq).trim() : ''
    const rhs = eq > 0 ? trimmed.slice(eq + 1).trim() : ''
    const node: SetNode = {
      type: 'set',
      line: ctx.line,
      varName,
      source: null,
      literalExpr: rhs,
      args: { ...input.attrs },
    }
    return node
  },
}

export default setDir
