import type { ParseModule, ParseContext, ASTNode, DefineNode } from '../types.js'

const define: ParseModule = {
  name: 'define',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const raw = args.trim()
    // The local marker can appear as either `@local` or `local` (bare).
    // The bare form is friendlier for authors; both forms set the same flag.
    const localMatch = raw.match(/(\s)@?local$/)
    const local = !!localMatch
    const withoutLocal = local ? raw.slice(0, localMatch!.index).trim() : raw

    // Detect name(param1, param2) syntax
    const parenMatch = withoutLocal.match(/^([\w-]+)\(([^)]*)\)$/)
    let name: string
    let params: string[]
    if (parenMatch) {
      name = parenMatch[1] ?? ''
      const inner = (parenMatch[2] ?? '').trim()
      params = inner ? inner.split(',').map(p => p.trim()).filter(Boolean) : []
    } else {
      name = withoutLocal.split(/\s+/)[0] ?? ''
      params = []
    }

    const node: DefineNode = { type: 'define', line: ctx.line, name, params, local, body: [], transitions: [] }
    return node
  },
}

export default define
