import type { ParseModule, ParseContext, ASTNode, NoteNode } from '../types.js'
import { parseArgs } from '../args.js'

const note: ParseModule = {
  name: 'note',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const visible = parsed.positional.includes('visible')
    const consumer = parsed.named['consumer']
    const node: NoteNode = { type: 'note', line: ctx.line, visible, body: '' }
    if (consumer !== undefined) node.consumer = consumer
    return node
  },
}

export default note
