import type { ParseModule, ParseContext, ASTNode, EnvNode } from '../types.js'
import { parseArgs } from '../args.js'

const env: ParseModule = {
  name: 'env',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.positional[0] ?? ''
    const fallback = parsed.named['fallback'] ?? null
    const node: EnvNode = { type: 'env', line: ctx.line, name, fallback }
    return node
  },
}

export default env
