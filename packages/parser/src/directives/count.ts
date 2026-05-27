import type { ParseModule, ParseContext, DirectiveInput, ASTNode, CountNode } from '../types.js'

const count: ParseModule = {
  name: 'count',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.positional || input.attrs['path'] || ''
    const node: CountNode = { type: 'count', line: ctx.line, path, args: { ...input.attrs } }
    return node
  },
}

export default count
