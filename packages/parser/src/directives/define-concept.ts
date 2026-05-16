import type { ParseModule, ParseContext, ASTNode, ConceptNode } from '../types.js'
import { parseArgs } from '../args.js'

const defineConcept: ParseModule = {
  name: 'define-concept',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.positional[0] ?? ''
    const definition = parsed.positional[1] ?? ''
    const node: ConceptNode = { type: 'define-concept', line: ctx.line, name, definition }
    return node
  },
}

export default defineConcept
