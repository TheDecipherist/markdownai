import type { ParseModule, ParseContext, DirectiveInput, ASTNode, MkdirNode } from '../types.js'

const mkdir: ParseModule = {
  name: 'mkdir',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.attrs['path'] ?? input.positional ?? ''
    const node: MkdirNode = { type: 'mkdir', line: ctx.line, path, args: { ...input.attrs } }
    return node
  },
}

export default mkdir
