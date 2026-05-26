import type { ParseModule, ParseContext, DirectiveInput, ASTNode, TreeNode } from '../types.js'

const tree: ParseModule = {
  name: 'tree',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.positional || input.attrs['path'] || ''
    const node: TreeNode = {
      type: 'tree',
      line: ctx.line,
      path,
      args: { ...input.attrs },
      cache: null,
    }
    return node
  },
}

export default tree
