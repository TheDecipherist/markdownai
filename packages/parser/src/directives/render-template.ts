import type { ParseModule, ParseContext, DirectiveInput, ASTNode, RenderTemplateNode } from '../types.js'

// v2 syntax:
//   @render-template
//     from="..."
//     to="..."
//     [force]
//   >
//     key1=value1
//     key2=value2
//   @render-template-end
//
// The body lines (after the `>` separator) are key=value pairs. We parse them
// here into the params map.
const renderTemplate: ParseModule = {
  name: 'render-template',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const from = input.attrs['from'] ?? ''
    const to = input.attrs['to'] ?? ''
    const named: Record<string, string> = { ...input.attrs }
    for (const tok of input.flags) {
      if (tok === 'force' || tok === 'if-missing') named[tok] = 'true'
    }
    // The v2 tokenizer may park a bare `force`/`if-missing` token in
    // `positional` if no other positional was set. Handle that.
    if (input.positional === 'force' || input.positional === 'if-missing') {
      named[input.positional] = 'true'
    }

    // Non-reserved attrs become template params. This handles the common
    // Form 2 syntax where params live on attr-lines (no `>` separator).
    const RESERVED_ATTRS = new Set(['from', 'to', 'force', 'if-missing', 'path'])
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(input.attrs)) {
      if (!RESERVED_ATTRS.has(k)) params[k] = v
    }
    // Walk body lines, parsing key=value into params. Ignore blank/comment lines.
    for (const raw of input.body) {
      const trimmed = raw.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      params[key] = val
    }

    const node: RenderTemplateNode = {
      type: 'render-template',
      line: ctx.line,
      from,
      to,
      params,
      args: named,
    }
    void ctx
    return node
  },
}

export default renderTemplate
