import type { ParseModule, ParseContext, ASTNode, CopyNode } from '../types.js'
import { parseArgs } from '../args.js'

// @copy from="src" to="dst" [if-missing]
// Examples:
//   @copy from="./templates/x.md" to=".mdd/x.md"
//   @copy from="${CLAUDE_SKILL_DIR}/templates/x.md" to=".mdd/x.md" if-missing
const copy: ParseModule = {
  name: 'copy',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const from = parsed.named['from'] ?? ''
    const to = parsed.named['to'] ?? ''
    // Bare flag tokens (e.g. `if-missing`) come through as positional. Surface
    // them in args as args["<flag>"]="true" so the executor can check them
    // uniformly with key-value args.
    const flagArgs: Record<string, string> = { ...parsed.named }
    for (const tok of parsed.positional) {
      if (/^[a-z][a-z0-9-]*$/i.test(tok)) flagArgs[tok] = 'true'
    }
    const node: CopyNode = { type: 'copy', line: ctx.line, from, to, args: flagArgs }
    return node
  },
}

export default copy
