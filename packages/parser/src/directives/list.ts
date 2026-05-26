import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ListNode } from '../types.js'

const list: ParseModule = {
  name: 'list',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.positional || input.attrs['path'] || ''
    const node: ListNode = {
      type: 'list',
      line: ctx.line,
      path,
      args: { ...input.attrs },
      cache: null,
    }
    return node
  },
}

export default list
