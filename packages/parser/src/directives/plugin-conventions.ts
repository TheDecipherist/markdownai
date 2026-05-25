import type { ParseModule, ParseContext, ASTNode, PluginConventionsNode } from '../types.js'

const pluginConventions: ParseModule = {
  name: 'plugin-conventions',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, _args: string, ctx: ParseContext): ASTNode {
    const node: PluginConventionsNode = { type: 'plugin-conventions', line: ctx.line, body: '' }
    return node
  },
}

export default pluginConventions
