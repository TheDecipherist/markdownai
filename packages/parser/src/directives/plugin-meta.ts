import type { ParseModule, ParseContext, ASTNode, PluginMetaNode } from '../types.js'

const pluginMeta: ParseModule = {
  name: 'plugin-meta',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, _args: string, ctx: ParseContext): ASTNode {
    const node: PluginMetaNode = { type: 'plugin-meta', line: ctx.line, body: '' }
    return node
  },
}

export default pluginMeta
