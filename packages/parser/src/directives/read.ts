import type { ParseModule, ParseContext, ASTNode, ReadNode } from '../types.js'
import { parseArgs } from '../args.js'

const read: ParseModule = {
  name: 'read',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    const node: ReadNode = {
      type: 'read',
      line: ctx.line,
      path,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default read
