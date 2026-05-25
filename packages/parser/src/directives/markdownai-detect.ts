import type { ParseModule, ParseContext, ASTNode, MarkdownaiDetectNode } from '../types.js'
import { parseArgs } from '../args.js'

const markdownaiDetect: ParseModule = {
  name: 'markdownai-detect',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const formatRaw = parsed.named['as'] ?? 'text'
    const format: 'text' | 'info' = formatRaw === 'info' ? 'info' : 'text'
    const includeRaw = parsed.named['include'] ?? ''
    const include = includeRaw ? includeRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    const label = parsed.named['label'] ?? null
    const projectOverride = parsed.named['project'] ?? null
    const node: MarkdownaiDetectNode = {
      type: 'markdownai-detect',
      line: ctx.line,
      format,
      include,
      label,
      projectOverride,
    }
    return node
  },
}

export default markdownaiDetect
