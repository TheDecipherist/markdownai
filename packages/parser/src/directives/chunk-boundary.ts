import type { ParseModule, ParseContext, ASTNode, ChunkBoundaryNode } from '../types.js'
import { parseArgs } from '../args.js'

const chunkBoundary: ParseModule = {
  name: 'chunk-boundary',
  block: false,
  parse(_rawLine: string, args: string, ctx: ParseContext): ASTNode {
    const parsed = parseArgs(args)
    const id = parsed.named['id'] ?? parsed.positional[0] ?? `chunk-${ctx.line}`
    const standalone = parsed.named['standalone'] === 'true'
    const node: ChunkBoundaryNode = { type: 'chunk-boundary', line: ctx.line, id, standalone }
    return node
  },
}

export default chunkBoundary
