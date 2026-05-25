import type { ParseModule, ParseContext, ASTNode, ConstraintNode } from '../types.js'
import { ParseError } from '../types.js'
import { parseArgs } from '../args.js'

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'warning', 'cosmetic'])

function isTemplatedValue(value: string): boolean {
  return value.includes('{{') && value.includes('}}')
}

const constraint: ParseModule = {
  name: 'constraint',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const id = parsed.named['id'] ?? parsed.positional[0] ?? `constraint-${ctx.line}`
    const rawSeverity = parsed.named['severity'] ?? 'high'
    // Templated severities resolve at engine evaluation time; the parser cannot
    // validate the literal value because the interpolation expression is unknown
    // until render. Skip the static check for any value containing {{ }}.
    if (!isTemplatedValue(rawSeverity) && !SEVERITIES.has(rawSeverity)) {
      throw new ParseError(`@constraint: invalid severity "${rawSeverity}" — must be critical, high, medium, low, warning, cosmetic, or a templated value`, ctx.line, ctx.filePath)
    }
    const severity = rawSeverity as ConstraintNode['severity']
    const node: ConstraintNode = { type: 'constraint', line: ctx.line, id, severity, body: '' }
    return node
  },
}

export default constraint
