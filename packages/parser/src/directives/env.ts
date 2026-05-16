import type { ParseModule, ParseContext, ASTNode, EnvNode } from '../types.js'
import { parseArgs } from '../args.js'
import { ParseError } from '../types.js'

const env: ParseModule = {
  name: 'env',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.positional[0] ?? ''
    if (!name) throw new ParseError('@env requires a variable name', ctx.line, ctx.filePath)
    const fallback = parsed.named['fallback'] ?? null
    const node: EnvNode = { type: 'env', line: ctx.line, name, fallback }
    return node
  },
}

export default env
