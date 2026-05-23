import type { ParseModule, ParseContext, ASTNode, ReadFrontmatterNode } from '../types.js'
import { parseArgs } from '../args.js'

// @read-frontmatter path="<file>" field="<field>" [label=<name>]
//
// Read a single top-level scalar (or list) value from a markdown file's YAML
// frontmatter block. Mirrors @update-frontmatter. Data-jail security.
//
// If a label is given, the value is stored as {{ label }} for later
// interpolation and @if checks. Without a label, the value is inlined at the
// directive's position.
const readFrontmatter: ParseModule = {
  name: 'read-frontmatter',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.named['path'] ?? ''
    const field = parsed.named['field'] ?? ''
    const node: ReadFrontmatterNode = {
      type: 'read-frontmatter',
      line: ctx.line,
      path,
      field,
      args: parsed.named,
    }
    return node
  },
}

export default readFrontmatter
