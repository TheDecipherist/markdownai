import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PluginLayoutNode } from '../types.js'

const pluginLayout: ParseModule = {
  name: 'plugin-layout',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const body = input.body.join('\n').trimEnd()
    const node: PluginLayoutNode = { type: 'plugin-layout', line: ctx.line, body }
    return node
  },
}

export default pluginLayout
