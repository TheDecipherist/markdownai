import type { ParseModule, ParseContext, ASTNode, EventNode } from '../types.js'
import { parseArgs } from '../args.js'
import { ParseError } from '../types.js'

const event: ParseModule = {
  name: 'event',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.named['name'] ?? ''
    const data = parsed.named['data'] ?? ''
    if (!name) throw new ParseError(`@event requires a name= argument`, ctx.line, ctx.filePath)
    if (!data) throw new ParseError(`@event requires a data= argument`, ctx.line, ctx.filePath)
    const rawTransport = parsed.named['transport'] ?? 'log'
    const transports = rawTransport
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
    const visible = parsed.positional.includes('visible')
    const node: EventNode = { type: 'event', line: ctx.line, name, data, transports, visible }
    return node
  },
}

export default event
