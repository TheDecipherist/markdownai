import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ConnectNode } from '../types.js'
import { ParseError } from '../types.js'

const connect: ParseModule = {
  name: 'connect',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const name = input.positional || input.attrs['name'] || ''
    const connectionType = input.attrs['type'] ?? ''
    if (!name) throw new ParseError('@connect requires a name', ctx.line, ctx.filePath)
    if (!connectionType) throw new ParseError('@connect requires type=<driver>', ctx.line, ctx.filePath)
    const rest: Record<string, string> = { ...input.attrs }
    delete rest['type']
    const local = input.flags.includes('local') || input.flags.includes('@local') || input.attrs['local'] === 'true'
    const node: ConnectNode = {
      type: 'connect',
      line: ctx.line,
      name,
      connectionType,
      args: rest,
      local,
    }
    return node
  },
}

export default connect
