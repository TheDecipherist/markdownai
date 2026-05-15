import type { ParseModule, ParseContext, ASTNode, QueryNode } from '../types.js'
import { parseArgs } from '../args.js'

const query: ParseModule = {
  name: 'query',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    // command may be a quoted string as first positional, or in named 'command' arg
    const command = parsed.positional[0] ?? parsed.named['command'] ?? ''
    const node: QueryNode = {
      type: 'query',
      line: ctx.line,
      command,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default query
