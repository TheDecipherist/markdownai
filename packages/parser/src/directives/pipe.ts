import type { ParseModule, ParseContext, ASTNode, PipeNode, PipeStage, RenderNode } from '../types.js'

// pipe.ts handles a full pipe chain line; the parser calls this after detecting unquoted |.
// The rawLine is the full pipe-chain line. args contains the full line (same as rawLine).

const BUILTINS = new Set([
  'grep', 'sort', 'head', 'tail', 'wc', 'uniq',
])

function isBuiltin(cmd: string): boolean {
  const first = cmd.trim().split(/\s+/)[0] ?? ''
  return BUILTINS.has(first)
}

function splitUnquotedPipe(line: string): string[] {
  const segments: string[] = []
  let current = ''
  let inQuote = false

  for (const ch of line) {
    if (inQuote) {
      if (ch === '"') inQuote = false
      current += ch
    } else if (ch === '"') {
      inQuote = true
      current += ch
    } else if (ch === '|') {
      segments.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) segments.push(current.trim())
  return segments
}

const pipe: ParseModule = {
  name: 'pipe',
  block: false,
  parse(rawLine: string, _args: string, ctx: ParseContext): ASTNode {
    const segments = splitUnquotedPipe(rawLine)
    const stages: PipeStage[] = []

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] ?? ''
      const isLast = i === segments.length - 1

      if (i === 0) {
        // Source stage — parse as a directive node via lazy import
        stages.push({ type: 'source', node: makeSourceNode(seg, ctx) })
      } else if (isLast && seg.startsWith('@render')) {
        const renderArgs = seg.replace(/^@render\s*/, '')
        const renderNode = makeRenderNode(renderArgs, ctx)
        stages.push({ type: 'sink', node: renderNode })
      } else if (isBuiltin(seg)) {
        stages.push({ type: 'builtin', command: seg })
      } else {
        stages.push({ type: 'shell', command: seg })
      }
    }

    const node: PipeNode = { type: 'pipe', line: ctx.line, stages }
    return node
  },
}

function makeSourceNode(seg: string, ctx: ParseContext): ASTNode {
  // Inline lazy parse of the source directive to avoid circular import.
  // We import registry dynamically only when needed.
  // For now, return a temporary node that the parser will fill in.
  // The parser calls pipe.parse() after detecting a pipe line; it pre-parses the source.
  // This stub is replaced by the parser with the real source node.
  return { type: 'passthrough', line: ctx.line, raw: seg } as ASTNode
}

function makeRenderNode(args: string, ctx: ParseContext): RenderNode {
  const named: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(args)) !== null) {
    if (m[1] && m[2] !== undefined) named[m[1]] = m[2]
  }
  return { type: 'render', line: ctx.line, args: named }
}

export { splitUnquotedPipe }
export default pipe
