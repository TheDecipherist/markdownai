import type { ParseModule, ParseContext, ASTNode, ListNode } from '../types.js'
import { parseArgs } from '../args.js'

const list: ParseModule = {
  name: 'list',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    const node: ListNode = {
      type: 'list',
      line: ctx.line,
      path,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default list
