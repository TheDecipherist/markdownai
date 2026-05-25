import type { ParseModule, ParseContext, ASTNode, PluginLayoutNode } from '../types.js'

const pluginLayout: ParseModule = {
  name: 'plugin-layout',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, _args: string, ctx: ParseContext): ASTNode {
    const node: PluginLayoutNode = { type: 'plugin-layout', line: ctx.line, body: '' }
    return node
  },
}

export default pluginLayout
