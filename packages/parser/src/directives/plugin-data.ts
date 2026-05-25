import type { ParseModule, ParseContext, ASTNode, PluginDataNode } from '../types.js'
import { parseArgs } from '../args.js'
import { ParseError } from '../types.js'

const pluginData: ParseModule = {
  name: 'plugin-data',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const name = parsed.named['name'] ?? ''
    if (!name) throw new ParseError('@plugin-data requires name=<plugin-name>', ctx.line, ctx.filePath)
    const includeRaw = parsed.named['include'] ?? ''
    const include = includeRaw ? includeRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    const label = parsed.named['label'] ?? null
    const projectOverride = parsed.named['project'] ?? null
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
