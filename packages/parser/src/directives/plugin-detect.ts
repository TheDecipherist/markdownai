import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PluginDetectNode } from '../types.js'

const pluginDetect: ParseModule = {
  name: 'plugin-detect',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const body = input.body.join('\n').trimEnd()
    const node: PluginDetectNode = { type: 'plugin-detect', line: ctx.line, body }
    return node
  },
}

export default pluginDetect
