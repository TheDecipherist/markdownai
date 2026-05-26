import type { ParseModule, ParseContext, DirectiveInput, ASTNode, HashNode } from '../types.js'

const hash: ParseModule = {
  name: 'hash',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.attrs['path'] ?? input.positional ?? ''
    const node: HashNode = {
      type: 'hash',
      line: ctx.line,
      path,
      args: { ...input.attrs },
    }
    return node
  },
}

export default hash
