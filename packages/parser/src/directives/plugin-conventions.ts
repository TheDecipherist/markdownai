import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PluginConventionsNode } from '../types.js'

const pluginConventions: ParseModule = {
  name: 'plugin-conventions',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const body = input.body.join('\n').trimEnd()
    const node: PluginConventionsNode = { type: 'plugin-conventions', line: ctx.line, body }
    return node
  },
}

export default pluginConventions
