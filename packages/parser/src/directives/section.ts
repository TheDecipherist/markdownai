import type { ParseModule, ParseContext, ASTNode, SectionNode } from '../types.js'
import { ParseError } from '../types.js'
import { parseArgs } from '../args.js'

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])

const section: ParseModule = {
  name: 'section',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const rawPriority = parsed.named['priority'] ?? 'medium'
    if (!PRIORITIES.has(rawPriority)) throw new ParseError(`@section: invalid priority "${rawPriority}" — must be critical, high, medium, or low`, ctx.line, ctx.filePath)
    const priority = rawPriority as SectionNode['priority']
    const id = parsed.named['id'] ?? parsed.positional[0] ?? null
    const node: SectionNode = { type: 'section', line: ctx.line, id, priority, body: [] }
    return node
  },
}

export default section
