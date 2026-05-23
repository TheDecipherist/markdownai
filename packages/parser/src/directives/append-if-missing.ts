import type { ParseModule, ParseContext, ASTNode, AppendIfMissingNode } from '../types.js'
import { parseArgs } from '../args.js'

// @append-if-missing path="..." text="..."
// Appends `text` to `path` only if `path` does not already contain `text`.
// Idempotent. Used for bootstrap patterns like adding .gitignore entries.
//
// Example:
//   @append-if-missing path=".gitignore" text=".mdd/audits/"
const appendIfMissing: ParseModule = {
  name: 'append-if-missing',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.named['path'] ?? ''
    const text = parsed.named['text'] ?? ''
    const node: AppendIfMissingNode = { type: 'append-if-missing', line: ctx.line, path, text, args: parsed.named }
    return node
  },
}

export default appendIfMissing
