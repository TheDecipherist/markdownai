import type { ParseModule, ParseContext, DirectiveInput, ASTNode, SwitchNode } from '../types.js'

const switchDir: ParseModule = {
  name: 'switch',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // rawArgs is the expression. Strip any trailing self-close already handled
    // by the parser (rawArgs has it removed).
    const expression = input.rawArgs.trim() || input.positional
    const node: SwitchNode = {
      type: 'switch',
      line: ctx.line,
      expression,
      cases: [],
      defaultBody: null,
    }
    return node
  },
}

export default switchDir
