import type { ParseModule, ParseContext, DirectiveInput, ASTNode, MarkdownaiDetectNode } from '../types.js'

const markdownaiDetect: ParseModule = {
  name: 'markdownai-detect',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const formatRaw = input.attrs['as'] ?? 'text'
    const format: 'text' | 'info' = formatRaw === 'info' ? 'info' : 'text'
    const includeRaw = input.attrs['include'] ?? ''
    const include = includeRaw ? includeRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    const label = input.attrs['label'] ?? null
    const projectOverride = input.attrs['project'] ?? null
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
