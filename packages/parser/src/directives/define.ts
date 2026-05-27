import type { ParseModule, ParseContext, DirectiveInput, ASTNode, DefineNode } from '../types.js'

const define: ParseModule = {
  name: 'define',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // Positional carries the macro name. It may include parens: name(p1, p2).
    // The tokenizer doesn't handle whitespace inside parens, so prefer rawArgs
    // when it contains `(`.
    const raw = input.positional || ''
    const rawArgs = input.rawArgs || ''
    let name: string
    let params: string[]
    // Try rawArgs first — it preserves the unsplit `name(p1, p2)` form.
    const parenSearch = rawArgs.match(/^([\w-]+)\(([^)]*)\)/)
    const parenMatch = parenSearch || raw.match(/^([\w-]+)\(([^)]*)\)$/)
    if (parenMatch) {
      name = parenMatch[1] ?? ''
      const inner = (parenMatch[2] ?? '').trim()
      params = inner ? inner.split(',').map(p => p.trim()).filter(Boolean) : []
    } else {
      name = raw.split(/\s+/)[0] ?? ''
      params = []
    }
    // Detect `@local` flag — may appear after the parens in rawArgs.
    const hasLocalInRaw = /(^|\s)@local(\s|$)/.test(rawArgs) || /(^|\s)local(\s|$)/.test(rawArgs.replace(/^[\w-]+\([^)]*\)/, ''))
    const local = input.flags.includes('local') || input.flags.includes('@local') || input.attrs['local'] === 'true' || hasLocalInRaw
    const node: DefineNode = { type: 'define', line: ctx.line, name, params, local, body: [], transitions: [] }
    return node
  },
}

export default define
