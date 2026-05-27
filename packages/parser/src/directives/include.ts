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
    const local = input.flags.includes('local') || input.flags.includes('@local') || input.attrs['local'] === 'true'
    // Condition can be specified as `if="..."` attribute, or as bare `if <expr>`
    // in the opener tail (legacy syntax preserved for ergonomics).
    let condition: string | null = input.attrs['if'] ?? null
    if (!condition) {
      // Look for an `if ...` segment in rawArgs after the path. Stop at `@local`.
      const m = input.rawArgs.match(/(?:^|\s)if\s+(.+?)(?:\s+@local\b)?\s*$/)
      if (m && m[1]) condition = m[1].trim()
    }
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
