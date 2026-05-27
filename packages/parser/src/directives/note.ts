import type { ParseModule, ParseContext, DirectiveInput, ASTNode, NoteNode } from '../types.js'

const note: ParseModule = {
  name: 'note',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const visible = input.flags.includes('visible')
      || input.positional === 'visible'
      || input.attrs['visible'] === 'true'
    const consumer = input.attrs['consumer']
    const body = input.body.join('\n').trim()
    const node: NoteNode = { type: 'note', line: ctx.line, visible, body }
    if (consumer !== undefined) node.consumer = consumer
    return node
  },
}

export default note
