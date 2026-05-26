import type { ParseModule, ParseContext, DirectiveInput, ASTNode, CopyNode } from '../types.js'

const copy: ParseModule = {
  name: 'copy',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const from = input.attrs['from'] ?? ''
    const to = input.attrs['to'] ?? ''
    const flagArgs: Record<string, string> = { ...input.attrs }
    for (const tok of input.flags) {
      if (/^[a-z][a-z0-9-]*$/i.test(tok)) flagArgs[tok] = 'true'
    }
    const node: CopyNode = { type: 'copy', line: ctx.line, from, to, args: flagArgs }
    return node
  },
}

export default copy
