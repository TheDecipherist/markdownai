import type { ParseModule, ParseContext, ASTNode, PhaseNode } from '../types.js'
import { ParseError } from '../types.js'

const phase: ParseModule = {
  name: 'phase',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const name = args.trim().split(/\s+/)[0] ?? ''
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
