import type { ParseModule, ParseContext, ASTNode, IncludeNode } from '../types.js'
import { parseArgs } from '../args.js'

const include: ParseModule = {
  name: 'include',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    const node: IncludeNode = {
      type: 'include',
      line: ctx.line,
      path,
      condition: parsed.condition,
      local: parsed.local,
      cache: parsed.cache,
    }
    return node
  },
}

export default include
