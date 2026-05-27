import type { ParseModule, ParseContext, DirectiveInput, ASTNode, PassthroughNode } from '../types.js'

// The pipe directive itself isn't reachable from the registry path under v2 —
// parser.ts intercepts any line containing an unquoted `|` and builds the
// PipeNode directly. This module remains so we can export the pipe splitter
// for shared use, and as a defensive passthrough if someone writes `@pipe`
// explicitly.

function splitUnquotedPipe(line: string): string[] {
  const segments: string[] = []
  let current = ''
  let inDouble = false
  let inSingle = false
  let braceDepth = 0  // tracks {{ ... }} interpolations

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    const next = line[i + 1]

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
    if (braceDepth > 0) {
      if (ch === '{' && next === '{') { braceDepth++; current += '{{'; i++; continue }
      if (ch === '}' && next === '}') { braceDepth--; current += '}}'; i++; continue }
      current += ch
      continue
    }

    if (ch === '"') { inDouble = true; current += ch; continue }
    if (ch === "'") { inSingle = true; current += ch; continue }
    if (ch === '{' && next === '{') { braceDepth++; current += '{{'; i++; continue }

    // || is logical-OR, not pipe.
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
  parse(input: DirectiveInput, ctx: ParseContext): ASTNode {
    void input
    return { type: 'passthrough', line: ctx.line, raw: `@pipe ${input.rawArgs}` } as PassthroughNode
  },
}

export { splitUnquotedPipe }
export default pipe
