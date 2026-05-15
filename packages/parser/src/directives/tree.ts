import type { ParseModule, ParseContext, ASTNode, TreeNode } from '../types.js'
import { parseArgs } from '../args.js'

const tree: ParseModule = {
  name: 'tree',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    const node: TreeNode = {
      type: 'tree',
      line: ctx.line,
      path,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default tree
