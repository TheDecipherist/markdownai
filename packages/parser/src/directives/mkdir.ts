import type { ParseModule, ParseContext, ASTNode, MkdirNode } from '../types.js'
import { parseArgs } from '../args.js'

// @mkdir path="..." [recursive=true] [path-args via positional]
// Examples:
//   @mkdir .mdd
//   @mkdir path=".mdd/docs"
//   @mkdir ".mdd" recursive=false
const mkdir: ParseModule = {
  name: 'mkdir',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.named['path'] ?? parsed.positional[0] ?? ''
    const node: MkdirNode = { type: 'mkdir', line: ctx.line, path, args: parsed.named }
    return node
  },
}

export default mkdir
