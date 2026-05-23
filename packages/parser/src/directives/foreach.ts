import type { ParseModule, ParseContext, ASTNode, ForeachNode } from '../types.js'

// @foreach <var> in <directive-or-expression>
//   body using {{ var }}
// @end
//
// Block directive that iterates a source expression. The source can be:
//   - a directive whose output is a list: @list, @read, @read-frontmatter (for
//     list-typed fields), @query
//   - a `{{ label }}` interpolation that resolves to a comma-joined list or
//     newline-separated list of items
//   - a comma-separated literal list
//
// Inside the body, `{{ <var> }}` is the current item. The body re-renders per
// iteration; nested directives that reference `{{ <var> }}` work as expected.
//
// The parser captures the source as a raw string. The engine parses it again
// against the directive registry — if the source starts with `@`, it is
// resolved as a sub-directive. Otherwise it is treated as a value expression.
const foreach: ParseModule = {
  name: 'foreach',
  block: true,
  closeTag: 'end',
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const trimmed = args.trim()
    // Expected: "<var> in <rest>"
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.*)$/)
    const varName = m?.[1] ?? ''
    const rest = (m?.[2] ?? '').trim()
    const node: ForeachNode = {
      type: 'foreach',
      line: ctx.line,
      varName,
      source: null,
      literalSource: rest,
      body: [],
      args: {},
    }
    return node
  },
}

export default foreach
