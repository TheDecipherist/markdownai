import type { ParseModule, ParseContext, ASTNode, GraphNode } from '../types.js'

// Handles ```mai-graph fenced blocks; the parser passes the raw body content.
const graph: ParseModule = {
  name: 'graph',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const node: GraphNode = { type: 'graph', line: ctx.line, raw: args }
    return node
  },
}

export default graph
