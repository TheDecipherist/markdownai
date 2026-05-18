import type { ParseModule, ParseContext, ASTNode, IncludeNode } from '../types.js'
import { parseArgs } from '../args.js'
import { ParseError } from '../types.js'

const include: ParseModule = {
  name: 'include',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    if (path.startsWith('/')) {
      throw new ParseError('@include does not allow absolute paths (filesystem confinement)', ctx.line, ctx.filePath)
    }
    if (path.split(/[/\\]/).some(seg => seg === '..')) {
      throw new ParseError('@include does not allow path traversal (..)', ctx.line, ctx.filePath)
    }
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
