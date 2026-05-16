import type { ParseModule, ParseContext, ASTNode, SectionNode } from '../types.js'
import { parseArgs } from '../args.js'

const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])

const section: ParseModule = {
  name: 'section',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const rawPriority = parsed.named['priority'] ?? 'medium'
    const priority = PRIORITIES.has(rawPriority)
      ? (rawPriority as SectionNode['priority'])
      : 'medium'
    const id = parsed.named['id'] ?? parsed.positional[0] ?? null
    const node: SectionNode = { type: 'section', line: ctx.line, id, priority, body: [] }
    return node
  },
}

export default section
