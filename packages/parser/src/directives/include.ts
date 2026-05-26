import type { ParseModule, ParseContext, DirectiveInput, ASTNode, IncludeNode } from '../types.js'
import { ParseError } from '../types.js'

const include: ParseModule = {
  name: 'include',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.positional || input.attrs['path'] || ''
    if (path.startsWith('/')) {
      throw new ParseError('@include does not allow absolute paths (filesystem confinement)', ctx.line, ctx.filePath)
    }
    if (path.split(/[/\\]/).some(seg => seg === '..')) {
      throw new ParseError('@include does not allow path traversal (..)', ctx.line, ctx.filePath)
    }
    const local = input.flags.includes('local') || input.attrs['local'] === 'true'
    const condition = input.attrs['if'] ?? null
    const node: IncludeNode = {
      type: 'include',
      line: ctx.line,
      path,
      condition,
      local,
      cache: null,
    }
    return node
  },
}

export default include
