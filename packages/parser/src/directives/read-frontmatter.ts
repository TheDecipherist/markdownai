import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ReadFrontmatterNode } from '../types.js'

const readFrontmatter: ParseModule = {
  name: 'read-frontmatter',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.attrs['path'] ?? ''
    const field = input.attrs['field'] ?? ''
    const node: ReadFrontmatterNode = {
      type: 'read-frontmatter',
      line: ctx.line,
      path,
      field,
      args: { ...input.attrs },
    }
    return node
  },
}

export default readFrontmatter
