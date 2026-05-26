import type { ParseModule, ParseContext, DirectiveInput, ASTNode, QueryNode } from '../types.js'

const query: ParseModule = {
  name: 'query',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // command can be the positional argument OR the `command=` attr OR — for
    // multi-token shell commands like `bash -c "echo hi"` — the positional
    // plus the flags joined back together.
    let command: string
    if (input.attrs['command']) {
      command = input.attrs['command']
    } else if (input.flags.length > 0) {
      // Recombine the positional + flag tokens, re-quoting any that contain spaces.
      const parts = [input.positional, ...input.flags].filter(Boolean)
      command = parts.map(p => p.includes(' ') ? `"${p}"` : p).join(' ')
    } else {
      command = input.positional
    }
    const node: QueryNode = {
      type: 'query',
      line: ctx.line,
      command,
      args: { ...input.attrs },
      cache: null,
    }
    return node
  },
}

export default query
