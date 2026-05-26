import type { ParseModule, ParseContext, ASTNode, TouchNode } from '../types.js'
import { parseArgs } from '../args.js'

// @touch path="..." [path-args via positional]
// Creates an empty file at path. Idempotent — if the file already exists,
// no-op. Parent directories are created recursively. Goes through the
// engine's write jail like @mkdir / @copy.
//
// Used by build flows to scaffold the source files declared in a wave
// brief's `**Source files.**` section so that:
//   1. Tests in Phase 4b can import from them (failing on "not implemented"
//      rather than "module not found").
//   2. `@derive-*` directives have files to walk when the doc is read.
//
// Examples:
//   @touch path="src/rules/parser.ts"
//   @touch "src/rules/registry-loader.ts"
const touch: ParseModule = {
  name: 'touch',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const path = parsed.named['path'] ?? parsed.positional[0] ?? ''
    const node: TouchNode = { type: 'touch', line: ctx.line, path, args: parsed.named }
    return node
  },
}

export default touch
