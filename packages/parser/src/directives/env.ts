import type { ParseModule, ParseContext, DirectiveInput, ASTNode, EnvNode } from '../types.js'
import { ParseError } from '../types.js'

const env: ParseModule = {
  name: 'env',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const name = input.positional || input.attrs['name'] || ''
    if (!name) throw new ParseError('@env requires a variable name', ctx.line, ctx.filePath)
    const fallback = input.attrs['fallback'] ?? null
    const node: EnvNode = { type: 'env', line: ctx.line, name, fallback }
    return node
  },
}

export default env
