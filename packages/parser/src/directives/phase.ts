import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PhaseNode } from '../types.js'
import { ParseError } from '../types.js'

const phase: ParseModule = {
  name: 'phase',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const name = input.positional
    if (!name) throw new ParseError('@phase requires a name', ctx.line, ctx.filePath)
    const node: PhaseNode = {
      type: 'phase',
      line: ctx.line,
      name,
      body: [],
      transitions: [],
    }
    return node
  },
}

export default phase
