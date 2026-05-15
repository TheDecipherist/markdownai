import type { ParseModule, ParseContext, ASTNode, ConditionalNode } from '../types.js'

const ifDirective: ParseModule = {
  name: 'if',
  block: true,
  closeTag: 'endif',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const condition = args.trim()
    const node: ConditionalNode = {
      type: 'conditional',
      line: ctx.line,
      branches: [{ condition, body: [] }],
    }
    return node
  },
}

export default ifDirective
