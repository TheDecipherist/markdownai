import type { ParseModule, ParseContext, ASTNode, ImportNode } from '../types.js'
import { ParseError } from '../types.js'
import { parseArgs } from '../args.js'

const importDirective: ParseModule = {
  name: 'import',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.positional[0] ?? ''
    if (path.startsWith('/')) {
      throw new ParseError('@import does not allow absolute paths (filesystem confinement)', ctx.line, ctx.filePath)
    }
    if (path.split(/[/\\]/).some(seg => seg === '..')) {
      throw new ParseError('@import does not allow path traversal (..)', ctx.line, ctx.filePath)
    }
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
