import type { ParseModule, ParseContext, DirectiveInput, ASTNode, GraphNode } from '../types.js'

// Handles ```mai-graph fenced blocks; the parser passes the raw body content
// in input.rawArgs (and input.positional).
const graph: ParseModule = {
  name: 'graph',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const raw = input.rawArgs || input.positional || ''
    const node: GraphNode = { type: 'graph', line: ctx.line, raw }
    return node
  },
}

export default graph
