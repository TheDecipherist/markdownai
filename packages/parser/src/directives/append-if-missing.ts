import type { ParseModule, ParseContext, DirectiveInput, ASTNode, AppendIfMissingNode } from '../types.js'

const appendIfMissing: ParseModule = {
  name: 'append-if-missing',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const path = input.attrs['path'] ?? ''
    const text = input.attrs['text'] ?? ''
    const node: AppendIfMissingNode = { type: 'append-if-missing', line: ctx.line, path, text, args: { ...input.attrs } }
    return node
  },
}

export default appendIfMissing
