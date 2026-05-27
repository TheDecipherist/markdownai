import type { ParseModule, ParseContext, DirectiveInput, ASTNode, TouchNode } from '../types.js'

const touch: ParseModule = {
  name: 'touch',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.attrs['path'] ?? input.positional ?? ''
    const node: TouchNode = { type: 'touch', line: ctx.line, path, args: { ...input.attrs } }
    return node
  },
}

export default touch
