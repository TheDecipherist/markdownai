import type { ParseModule, ParseContext, DirectiveInput, ASTNode, DefineNode } from '../types.js'

const define: ParseModule = {
  name: 'define',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // Positional carries the macro name. It may include parens: name(p1, p2).
    const raw = input.positional || ''
    let name: string
    let params: string[]
    const parenMatch = raw.match(/^([\w-]+)\(([^)]*)\)$/)
    if (parenMatch) {
      name = parenMatch[1] ?? ''
      const inner = (parenMatch[2] ?? '').trim()
      params = inner ? inner.split(',').map(p => p.trim()).filter(Boolean) : []
    } else {
      name = raw.split(/\s+/)[0] ?? ''
      params = []
    }
    const local = input.flags.includes('local') || input.flags.includes('@local') || input.attrs['local'] === 'true'
    const node: DefineNode = { type: 'define', line: ctx.line, name, params, local, body: [], transitions: [] }
    return node
  },
}

export default define
