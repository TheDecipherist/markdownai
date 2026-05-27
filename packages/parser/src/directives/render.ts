import type { ParseModule, ParseContext, DirectiveInput, ASTNode, RenderNode } from '../types.js'

const render: ParseModule = {
  name: 'render',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const node: RenderNode = { type: 'render', line: ctx.line, args: { ...input.attrs } }
    return node
  },
}

export default render
