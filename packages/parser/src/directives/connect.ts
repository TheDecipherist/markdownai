import type { ParseModule, ParseContext, ASTNode, ConnectNode } from '../types.js'
import { parseArgs } from '../args.js'

const connect: ParseModule = {
  name: 'connect',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.positional[0] ?? ''
    const connectionType = parsed.named['type'] ?? ''
    const rest: Record<string, string> = { ...parsed.named }
    delete rest['type']
    const node: ConnectNode = {
      type: 'connect',
      line: ctx.line,
      name,
      connectionType,
      args: rest,
      local: parsed.local,
    }
    return node
  },
}

export default connect
