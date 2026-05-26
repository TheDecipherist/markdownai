import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PromptNode } from '../types.js'

const prompt: ParseModule = {
  name: 'prompt',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // Role is the positional (e.g. `@prompt instruction`) or the role= attr.
    const role = input.positional || input.attrs['role'] || 'context'
    const body = input.body.join('\n').trim()
    const node: PromptNode = { type: 'prompt', line: ctx.line, role, body }
    return node
  },
}

export default prompt
