import type { ParseModule, ParseContext, ASTNode, RenderNode } from '../types.js'
import { parseArgs } from '../args.js'

const render: ParseModule = {
  name: 'render',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const node: RenderNode = { type: 'render', line: ctx.line, args: parsed.named }
    return node
  },
}

export default render
