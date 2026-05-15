import type { ParseModule, ParseContext, ASTNode, ImportNode } from '../types.js'
import { parseArgs } from '../args.js'

const importDirective: ParseModule = {
  name: 'import',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    const node: ImportNode = {
      type: 'import',
      line: ctx.line,
      path,
      condition: parsed.condition,
      local: parsed.local,
      cache: parsed.cache,
    }
    return node
  },
}

export default importDirective
