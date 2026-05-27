import type { ParseModule, ParseContext, DirectiveInput, ASTNode, UpdateFrontmatterNode } from '../types.js'

const updateFrontmatter: ParseModule = {
  name: 'update-frontmatter',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.attrs['path'] ?? ''
    const field = input.attrs['field'] ?? ''
    const value = input.attrs['value'] ?? ''
    const node: UpdateFrontmatterNode = {
      type: 'update-frontmatter',
      line: ctx.line,
      path,
      field,
      value,
      args: { ...input.attrs },
    }
    return node
  },
}

export default updateFrontmatter
