import type { ParseModule, ParseContext, DirectiveInput, ASTNode, TestNode } from '../types.js'

const test: ParseModule = {
  name: 'test',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const command = input.attrs['command'] ?? null
    const node: TestNode = {
      type: 'test',
      line: ctx.line,
      command,
      args: { ...input.attrs },
    }
    return node
  },
}

export default test
