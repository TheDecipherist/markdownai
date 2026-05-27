import type { ParseModule, ParseContext, DirectiveInput, ASTNode, EventNode } from '../types.js'
import { ParseError } from '../types.js'

const event: ParseModule = {
  name: 'event',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    // The event name is the positional argument (e.g. `@event build-start`) or
    // the legacy `name=` attribute form.
    const name = input.positional || input.attrs['name'] || ''
    if (!name) throw new ParseError('@event requires a name (positional or name= attr)', ctx.line, ctx.filePath)
    const data = input.attrs['data'] ?? ''
    const rawTransport = input.attrs['transport'] ?? 'log'
    const transports = rawTransport
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
    const visible = input.flags.includes('visible') || input.attrs['visible'] === 'true'
    const node: EventNode = { type: 'event', line: ctx.line, name, data, transports, visible }
    return node
  },
}

export default event
