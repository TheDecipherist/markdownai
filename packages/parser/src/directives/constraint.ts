import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ConstraintNode } from '../types.js'
import { ParseError } from '../types.js'

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'warning', 'cosmetic'])

function isTemplatedValue(value: string): boolean {
  return value.includes('{{') && value.includes('}}')
}

const constraint: ParseModule = {
  name: 'constraint',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const id = input.attrs['id'] ?? input.positional ?? `constraint-${ctx.line}`
    const rawSeverity = input.attrs['severity'] ?? 'high'
    if (!isTemplatedValue(rawSeverity) && !SEVERITIES.has(rawSeverity)) {
      throw new ParseError(
        `@constraint: invalid severity "${rawSeverity}" — must be critical, high, medium, low, warning, cosmetic, or a templated value`,
        ctx.line, ctx.filePath,
      )
    }
    const severity = rawSeverity as ConstraintNode['severity']
    const body = input.body.join('\n').trim()
    const node: ConstraintNode = { type: 'constraint', line: ctx.line, id, severity, body }
    return node
  },
}

export default constraint
