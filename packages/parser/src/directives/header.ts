import type { ParseModule, ParseContext, DirectiveInput, ASTNode, HeaderNode } from '../types.js'

const header: ParseModule = {
  name: 'markdownai',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // Parse out the version (e.g. `v2.0`) from rawArgs.
    const m = input.rawArgs.match(/^v(\d+\.\d+)\b/)
    const version = m?.[1] ?? null
    const node: HeaderNode = { type: 'header', line: ctx.line, version }
    return node
  },
}

export default header
