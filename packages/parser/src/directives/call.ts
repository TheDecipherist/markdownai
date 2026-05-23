import type { ParseModule, ParseContext, ASTNode, CallNode } from '../types.js'
import { parseArgs } from '../args.js'
import { ParseError } from '../types.js'

function unquote(s: string): string {
  if (s.length >= 2) {
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1)
  }
  return s
}

// Split on commas but respect quoted strings — values may contain commas.
function splitCommaArgs(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let inDouble = false
  let inSingle = false
  for (const ch of s) {
    if (inDouble) { if (ch === '"') inDouble = false; cur += ch; continue }
    if (inSingle) { if (ch === "'") inSingle = false; cur += ch; continue }
    if (ch === '"') { inDouble = true; cur += ch; continue }
    if (ch === "'") { inSingle = true; cur += ch; continue }
    if (ch === ',') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const call: ParseModule = {
  name: 'call',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const raw = args.trim()
    if (!raw) throw new ParseError('@call requires a macro name', ctx.line, ctx.filePath)

    // Detect name(arg1, arg2) or name(key=value) paren syntax — [\w-]+ matches hyphens like @define
    const parenMatch = raw.match(/^([\w-]+)\(([^)]*)\)$/)
    if (parenMatch) {
      const name = parenMatch[1] ?? ''
      const inner = (parenMatch[2] ?? '').trim()
      const items = inner ? splitCommaArgs(inner).map(s => s.trim()).filter(Boolean) : []
      const isNamed = items.some(s => s.includes('='))
      if (isNamed) {
        const namedArgs: Record<string, string> = {}
        const positional: string[] = []
        for (const item of items) {
          const eqIdx = item.indexOf('=')
          if (eqIdx !== -1) {
            const key = item.slice(0, eqIdx).trim()
            namedArgs[key] = unquote(item.slice(eqIdx + 1).trim())
          } else {
            positional.push(unquote(item))
          }
        }
        return { type: 'call', line: ctx.line, name, args: namedArgs, positionalArgs: positional }
      }
      return { type: 'call', line: ctx.line, name, args: {}, positionalArgs: items.map(unquote) }
    }

    // Space-separated syntax: @call name key=value
    const parsed = parseArgs(raw)
    const name = parsed.positional[0] ?? ''
    if (!name) throw new ParseError('@call requires a macro name', ctx.line, ctx.filePath)
    return { type: 'call', line: ctx.line, name, args: parsed.named, positionalArgs: parsed.positional.slice(1) }
  },
}

export default call
