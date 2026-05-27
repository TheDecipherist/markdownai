import type { ParseModule, ParseContext, DirectiveInput, ASTNode, CheckNode } from '../types.js'

const check: ParseModule = {
  name: 'check',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const command = input.attrs['command'] ?? null
    const node: CheckNode = {
      type: 'check',
      line: ctx.line,
      command,
      args: { ...input.attrs },
    }
    return node
  },
}

export default check
