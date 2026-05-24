import type { ParseModule, ParseContext, ASTNode, SwitchNode } from '../types.js'

const switchDir: ParseModule = {
  name: 'switch',
  block: true,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const node: SwitchNode = {
      type: 'switch',
      line: ctx.line,
      expression: args.trim(),
      cases: [],
      defaultBody: null,
    }
    return node
  },
}

export default switchDir
