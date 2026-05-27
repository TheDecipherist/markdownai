import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PluginDataNode } from '../types.js'
import { ParseError } from '../types.js'

const pluginData: ParseModule = {
  name: 'plugin-data',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const name = input.attrs['name'] ?? input.positional ?? ''
    if (!name) throw new ParseError('@plugin-data requires name=<plugin-name>', ctx.line, ctx.filePath)
    const includeRaw = input.attrs['include'] ?? ''
    const include = includeRaw ? includeRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    const label = input.attrs['label'] ?? null
    const projectOverride = input.attrs['project'] ?? null
    const node: PluginDataNode = {
      type: 'plugin-data',
      line: ctx.line,
      name,
      include,
      label,
      projectOverride,
    }
    return node
  },
}

export default pluginData
