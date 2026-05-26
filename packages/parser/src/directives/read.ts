import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ReadNode } from '../types.js'

const read: ParseModule = {
  name: 'read',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.positional || input.attrs['path'] || ''
    const node: ReadNode = {
      type: 'read',
      line: ctx.line,
      path,
      args: { ...input.attrs },
      cache: null,
    }
    return node
  },
}

export default read
