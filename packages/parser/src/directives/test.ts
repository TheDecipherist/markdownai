import type { ParseModule, ParseContext, ASTNode, TestNode } from '../types.js'
import { parseArgs } from '../args.js'

// @test [command="<cmd>"] [label=<name>] [budget=<N>]
//
// Runs the project's test suite. If `command=` is omitted, auto-detects from
// the project's package.json `scripts.test` field at the cwd. Recognizes
// vitest / jest / playwright / node-test output to produce a clean pass/fail
// summary; falls back to tail-N for unknown runners.
//
// Security: requires `shell.enabled: true` + matching `shell.allow_patterns`
// pattern on the resolved command (same audit log as @query).
const test: ParseModule = {
  name: 'test',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const command = parsed.named['command'] ?? null
    const node: TestNode = {
      type: 'test',
      line: ctx.line,
      command,
      args: parsed.named,
    }
    return node
  },
}

export default test
