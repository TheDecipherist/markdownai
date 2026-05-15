import type { ParseModule, ParseContext, ASTNode, DefineNode } from '../types.js'

const define: ParseModule = {
  name: 'define',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parts = args.trim().split(/\s+/)
    const name = parts[0] ?? ''
    const local = parts.includes('@local')
    const node: DefineNode = { type: 'define', line: ctx.line, name, local, body: [] }
    return node
  },
}

export default define
