import type { ParseModule, ParseContext, DirectiveInput, ASTNode, SectionNode } from '../types.js'
import { ParseError } from '../types.js'

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])

const section: ParseModule = {
  name: 'section',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const rawPriority = input.attrs['priority'] ?? 'medium'
    if (!PRIORITIES.has(rawPriority)) {
      throw new ParseError(
        `@section: invalid priority "${rawPriority}" — must be critical, high, medium, or low`,
        ctx.line, ctx.filePath,
      )
    }
    const priority = rawPriority as SectionNode['priority']
    const id = input.attrs['id'] ?? input.positional ?? null
    const node: SectionNode = { type: 'section', line: ctx.line, id: id || null, priority, body: [] }
    return node
  },
}

export default section
