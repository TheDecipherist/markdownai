import type { ParseModule, ParseContext, ASTNode, ConstraintNode } from '../types.js'
import { parseArgs } from '../args.js'

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])

const constraint: ParseModule = {
  name: 'constraint',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const id = parsed.named['id'] ?? parsed.positional[0] ?? `constraint-${ctx.line}`
    const rawSeverity = parsed.named['severity'] ?? 'high'
    const severity = SEVERITIES.has(rawSeverity)
      ? (rawSeverity as ConstraintNode['severity'])
      : 'high'
    const node: ConstraintNode = { type: 'constraint', line: ctx.line, id, severity, body: '' }
    return node
  },
}

export default constraint
