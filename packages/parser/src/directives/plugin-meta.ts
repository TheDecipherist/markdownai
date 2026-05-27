import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PluginMetaNode } from '../types.js'

const pluginMeta: ParseModule = {
  name: 'plugin-meta',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const body = input.body.join('\n').trimEnd()
    const node: PluginMetaNode = { type: 'plugin-meta', line: ctx.line, body }
    return node
  },
}

export default pluginMeta
