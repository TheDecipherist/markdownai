import type { ParseModule, ParseContext, ASTNode, ConstraintNode } from '../types.js'
import { ParseError } from '../types.js'
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
    if (!SEVERITIES.has(rawSeverity)) throw new ParseError(`@constraint: invalid severity "${rawSeverity}" — must be critical, high, medium, or low`, ctx.line, ctx.filePath)
    const severity = rawSeverity as ConstraintNode['severity']
    const node: ConstraintNode = { type: 'constraint', line: ctx.line, id, severity, body: '' }
    return node
  },
}

export default constraint
