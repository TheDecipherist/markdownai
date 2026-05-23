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
  let inDouble = false
  let inSingle = false
  let braceDepth = 0  // tracks {{ ... }} interpolations

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    const next = line[i + 1]

    // Inside a quoted string: track close-quote, treat everything else literally.
    if (inDouble) {
      if (ch === '"') inDouble = false
      current += ch
      continue
    }
    if (inSingle) {
      if (ch === "'") inSingle = false
      current += ch
      continue
    }
    // Inside a {{ }} interpolation: || and | are JS operators, not pipes.
    if (braceDepth > 0) {
      if (ch === '{' && next === '{') { braceDepth++; current += '{{'; i++; continue }
      if (ch === '}' && next === '}') { braceDepth--; current += '}}'; i++; continue }
      current += ch
      continue
    }

    if (ch === '"') { inDouble = true; current += ch; continue }
    if (ch === "'") { inSingle = true; current += ch; continue }
    if (ch === '{' && next === '{') { braceDepth++; current += '{{'; i++; continue }

    // || is a logical OR operator in @if conditions and JS expressions —
    // NOT a pipe separator. Treat as two literal characters.
    if (ch === '|' && next === '|') { current += '||'; i++; continue }

    if (ch === '|') {
      segments.push(current.trim())
      current = ''
      continue
    }

    current += ch
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
  // Stub: the real pipe parsing path is parsePipeLine() in parser.ts (triggered by unquoted | detection).
  // This module's parse() is only reachable if someone writes an explicit @pipe directive, which is
  // uncommon. Returning passthrough here is intentional — the engine will skip unknown stage types.
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
