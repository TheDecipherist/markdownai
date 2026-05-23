import type { ParseModule, ParseContext, ASTNode, UpdateFrontmatterNode } from '../types.js'
import { parseArgs } from '../args.js'

// @update-frontmatter path="<file>" field="<field>" value="<value>"
// Examples:
//   @update-frontmatter path=".mdd/docs/01-mdd.md" field="status" value="complete"
//   @update-frontmatter path=".mdd/waves/wave-1.md" field="last_synced" value="2026-05-23"
//
// Replaces the value of a YAML frontmatter field (between the leading --- delimiters)
// in a single regex pass. Idempotent: writing the same value is a no-op.
const updateFrontmatter: ParseModule = {
  name: 'update-frontmatter',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.named['path'] ?? ''
    const field = parsed.named['field'] ?? ''
    const value = parsed.named['value'] ?? ''
    const node: UpdateFrontmatterNode = {
      type: 'update-frontmatter',
      line: ctx.line,
      path,
      field,
      value,
      args: parsed.named,
    }
    return node
  },
}

export default updateFrontmatter
