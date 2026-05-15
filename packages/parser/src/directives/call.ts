import type { ParseModule, ParseContext, ASTNode, CallNode } from '../types.js'
import { parseArgs } from '../args.js'

const call: ParseModule = {
  name: 'call',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const raw = args.trim()

    // Detect name(arg1, arg2) or name(key=value) paren syntax
    const parenMatch = raw.match(/^(\w+)\(([^)]*)\)$/)
    if (parenMatch) {
      const name = parenMatch[1] ?? ''
      const inner = (parenMatch[2] ?? '').trim()
      const items = inner ? inner.split(',').map(s => s.trim()).filter(Boolean) : []
      const isNamed = items.some(s => s.includes('='))
      if (isNamed) {
        const namedArgs: Record<string, string> = {}
        for (const item of items) {
          const eqIdx = item.indexOf('=')
          if (eqIdx !== -1) namedArgs[item.slice(0, eqIdx).trim()] = item.slice(eqIdx + 1).trim()
        }
        return { type: 'call', line: ctx.line, name, args: namedArgs, positionalArgs: [] }
      }
      return { type: 'call', line: ctx.line, name, args: {}, positionalArgs: items }
    }

    // Space-separated syntax: @call name key=value
    const parsed = parseArgs(raw)
    const name = parsed.positional[0] ?? ''
    return { type: 'call', line: ctx.line, name, args: parsed.named, positionalArgs: parsed.positional.slice(1) }
  },
}

export default call
