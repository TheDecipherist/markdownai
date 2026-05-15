import type { ParseModule, ParseContext, ASTNode, HeaderNode } from '../types.js'

const header: ParseModule = {
  name: 'markdownai',
  block: false,
  parse(rawLine: string, _args: string, ctx: ParseContext): ASTNode {
    const m = rawLine.trim().match(/^@markdownai(?:\s+v(\d+\.\d+))?/)
    const version = m?.[1] ?? null
    const node: HeaderNode = { type: 'header', line: ctx.line, version }
    return node
  },
}

export default header
