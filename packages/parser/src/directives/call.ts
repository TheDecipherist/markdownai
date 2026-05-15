import type { ParseModule, ParseContext, ASTNode, CallNode } from '../types.js'
import { parseArgs } from '../args.js'

const call: ParseModule = {
  name: 'call',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.positional[0] ?? ''
    const node: CallNode = { type: 'call', line: ctx.line, name, args: parsed.named }
    return node
  },
}

export default call
