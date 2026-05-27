import type { ParseModule, ParseContext, DirectiveInput, ASTNode, ChunkBoundaryNode } from '../types.js'

const chunkBoundary: ParseModule = {
  name: 'chunk-boundary',
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    const id = input.attrs['id'] || input.positional || `chunk-${ctx.line}`
    const standalone = input.attrs['standalone'] === 'true'
    const node: ChunkBoundaryNode = { type: 'chunk-boundary', line: ctx.line, id, standalone }
    return node
  },
}

export default chunkBoundary
