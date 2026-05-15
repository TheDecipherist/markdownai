import type { ParseModule, ParseContext, ASTNode, CountNode } from '../types.js'
import { parseArgs } from '../args.js'

const count: ParseModule = {
  name: 'count',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    const node: CountNode = { type: 'count', line: ctx.line, path, args: parsed.named }
    return node
  },
}

export default count
