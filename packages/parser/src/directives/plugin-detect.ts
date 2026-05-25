import type { ParseModule, ParseContext, ASTNode, PluginDetectNode } from '../types.js'

const pluginDetect: ParseModule = {
  name: 'plugin-detect',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, _args: string, ctx: ParseContext): ASTNode {
    const node: PluginDetectNode = { type: 'plugin-detect', line: ctx.line, body: '' }
    return node
  },
}

export default pluginDetect
