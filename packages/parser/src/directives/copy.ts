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
    // A bare flag like `if-missing` may also land in positional when it's
    // the only non-attr token on the opener line.
    if (input.positional && /^[a-z][a-z0-9-]*$/i.test(input.positional)) {
      flagArgs[input.positional] = 'true'
    }
    const node: CopyNode = { type: 'copy', line: ctx.line, from, to, args: flagArgs }
    return node
  },
}

export default copy
