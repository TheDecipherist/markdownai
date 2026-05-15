import type { ParseModule, ParseContext, ASTNode, DbNode } from '../types.js'
import { parseArgs } from '../args.js'

const db: ParseModule = {
  name: 'db',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const node: DbNode = {
      type: 'db',
      line: ctx.line,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default db
