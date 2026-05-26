import type { ParseModule, ParseContext, DirectiveInput, ASTNode, HttpNode } from '../types.js'

const http: ParseModule = {
  name: 'http',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const node: HttpNode = {
      type: 'http',
      line: ctx.line,
      args: { ...input.attrs },
      cache: null,
    }
    return node
  },
}

export default http
