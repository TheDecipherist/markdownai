import type { ParseModule, ParseContext, DirectiveInput, ASTNode, DbNode } from '../types.js'

const db: ParseModule = {
  name: 'db',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const node: DbNode = {
      type: 'db',
      line: ctx.line,
      args: { ...input.attrs },
      cache: null,
    }
    return node
  },
}

export default db
