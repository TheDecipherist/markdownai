import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ConditionalNode } from '../types.js'

const ifDirective: ParseModule = {
  name: 'if',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // The condition is the full rawArgs (positional + attrs joined). The
    // parser pre-tokenizer may split `{{ a == b }}` into multiple "tokens",
    // so we use rawArgs verbatim.
    const condition = input.rawArgs.trim()
    const node: ConditionalNode = {
      type: 'conditional',
      line: ctx.line,
      branches: [{ condition, body: [] }],
    }
    return node
  },
}

export default ifDirective
