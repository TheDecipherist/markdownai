import type { ParseModule, ParseContext, DirectiveInput, ASTNode, DateNode } from '../types.js'
import { ParseError } from '../types.js'

const date: ParseModule = {
  name: 'date',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    if (input.attrs['type'] === 'created') {
      throw new ParseError('created is unreliable on Linux; use git log instead', ctx.line, ctx.filePath)
    }
    const node: DateNode = { type: 'date', line: ctx.line, args: { ...input.attrs } }
    return node
  },
}

export default date
