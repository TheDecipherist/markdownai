import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ForeachNode } from '../types.js'

// @foreach <var> in <source-expression>
//
// rawArgs carries the full `<var> in <source>` text from the opener line.
// The body is recursively parsed by the parser and assigned to node.body.
const foreach: ParseModule = {
  name: 'foreach',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const trimmed = input.rawArgs.trim()
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.*)$/)
    const varName = m?.[1] ?? ''
    const rest = (m?.[2] ?? '').trim()
    const node: ForeachNode = {
      type: 'foreach',
      line: ctx.line,
      varName,
      source: null,
      literalSource: rest,
      body: [],
      args: { ...input.attrs },
    }
    return node
  },
}

export default foreach
