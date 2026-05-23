import type { ParseModule, ParseContext, ASTNode, CheckNode } from '../types.js'
import { parseArgs } from '../args.js'

// @check [command="<cmd>"] [label=<name>] [budget=<N>]
//
// Analogue of @test for typecheck / lint / format / build runners. Auto-detects
// from package.json scripts in this order if `command=` is omitted:
//   typecheck > check > lint > build
//
// Recognizers for tsc / eslint / prettier output. Same security gating as
// @test and @query.
const check: ParseModule = {
  name: 'check',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const command = parsed.named['command'] ?? null
    const node: CheckNode = {
      type: 'check',
      line: ctx.line,
      command,
      args: parsed.named,
    }
    return node
  },
}

export default check
