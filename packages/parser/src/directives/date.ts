import type { ParseModule, ParseContext, ASTNode, DateNode } from '../types.js'
import { parseArgs } from '../args.js'

const date: ParseModule = {
  name: 'date',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const node: DateNode = { type: 'date', line: ctx.line, args: parsed.named }
    return node
  },
}

export default date
