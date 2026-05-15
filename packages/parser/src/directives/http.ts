import type { ParseModule, ParseContext, ASTNode, HttpNode } from '../types.js'
import { parseArgs } from '../args.js'

const http: ParseModule = {
  name: 'http',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const node: HttpNode = {
      type: 'http',
      line: ctx.line,
      args: parsed.named,
      cache: parsed.cache,
    }
    return node
  },
}

export default http
