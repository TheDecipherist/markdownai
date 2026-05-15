import type {
  ASTNode, ParseResult, ParseOptions, ParseContext,
  HeaderNode, MarkdownNode, PassthroughNode, TransitionNode, TransitionAction,
  PhaseNode, DefineNode, ConditionalNode, ConditionalBranch, PipeNode, PipeStage,
  RenderNode, GraphNode,
} from './types.js'
import { ParseError } from './types.js'
import { getModule } from './registry.js'
import { scanInterpolations } from './interpolation.js'
import { splitUnquotedPipe } from './directives/pipe.js'

const BUILTINS = new Set(['grep', 'sort', 'head', 'tail', 'wc', 'uniq'])

interface State {
  lines: string[]
  pos: number
  filePath: string
  inImport: boolean
}

function lineNum(state: State): number { return state.pos + 1 }

function peek(state: State): string | undefined { return state.lines[state.pos] }

function consume(state: State): string {
  const line = state.lines[state.pos] ?? ''
  state.pos++
  return line
}

function makeMarkdown(text: string, line: number): MarkdownNode {
  return { type: 'markdown', line, text, interpolations: scanInterpolations(text) }
}

function parseTransition(raw: string, line: number, filePath: string): TransitionNode {
  const m = raw.match(/^@on\s+complete\s+->\s+@(\w+)\s+(.+)$/)
  if (!m) throw new ParseError('Invalid @on syntax; expected: @on complete -> @phase|@call name', line, filePath)
  const directive = m[1]!
  const target = m[2]!.trim()
  let action: TransitionAction
  if (directive === 'phase') {
    action = { type: 'phase', name: target }
  } else if (directive === 'call') {
    const parts = target.split(/\s+/)
    action = { type: 'macro', name: parts[0] ?? '', args: {} }
  } else {
    throw new ParseError(`Unknown transition action: @${directive}`, line, filePath)
  }
  return { type: 'transition', line, event: 'complete', action }
}

function parseDefineBlock(state: State, openLine: string, line: number): DefineNode {
  const mod = getModule('define')!
  const args = openLine.replace(/^@define\s*/, '')
  const ctx: ParseContext = { line, filePath: state.filePath, inImport: state.inImport }
  const node = mod.parse(openLine, args, ctx) as DefineNode
  node.body = collectBody(state, 'end')
  return node
}

function parsePhaseBlock(state: State, openLine: string, line: number): PhaseNode {
  if (state.inImport) throw new ParseError('@phase is not valid in @import context', line, state.filePath)
  const mod = getModule('phase')!
  const args = openLine.replace(/^@phase\s*/, '')
  const ctx: ParseContext = { line, filePath: state.filePath, inImport: state.inImport }
  const node = mod.parse(openLine, args, ctx) as PhaseNode
  const transitions: TransitionNode[] = []
  const body: ASTNode[] = []

  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === '@end') { consume(state); break }
    if (trimmed.startsWith('@on ')) {
      transitions.push(parseTransition(trimmed, lineNum(state), state.filePath))
      consume(state)
    } else {
      const child = parseNextNode(state)
      if (child) body.push(child)
    }
  }

  node.body = body
  node.transitions = transitions
  return node
}

function parseIfBlock(state: State, condition: string, line: number): ConditionalNode {
  const branches: ConditionalBranch[] = [{ condition, body: [] }]
  let current = branches[0]!

  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === '@endif') { consume(state); break }
    if (trimmed.startsWith('@elseif ')) {
      const cond = trimmed.replace(/^@elseif\s+/, '')
      branches.push({ condition: cond, body: [] })
      current = branches[branches.length - 1]!
      consume(state)
    } else if (trimmed === '@else') {
      branches.push({ condition: null, body: [] })
      current = branches[branches.length - 1]!
      consume(state)
    } else {
      const child = parseNextNode(state)
      if (child) current.body.push(child)
    }
  }

  return { type: 'conditional', line, branches }
}

function collectBody(state: State, closeTag: string): ASTNode[] {
  const nodes: ASTNode[] = []
  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === `@${closeTag}`) { consume(state); break }
    const node = parseNextNode(state)
    if (node) nodes.push(node)
  }
  return nodes
}

function extractAs(node: ASTNode): string | null {
  if ('args' in node && node.args !== null && typeof node.args === 'object' && !Array.isArray(node.args)) {
    const args = node.args as Record<string, string>
    const asType = args['as']
    if (typeof asType === 'string') {
      delete args['as']
      return asType
    }
  }
  return null
}

function parsePipeLine(raw: string, line: number, state: State): PipeNode {
  const segments = splitUnquotedPipe(raw)
  const stages: PipeStage[] = []
  let sourceAsType: string | null = null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const isLast = i === segments.length - 1

    if (i === 0) {
      const trimmed = seg.trim()
      const sourceNode = parseDirective(trimmed, line, state, true)
      sourceAsType = extractAs(sourceNode)
      stages.push({ type: 'source', node: sourceNode })
    } else if (isLast && seg.trimStart().startsWith('@render')) {
      const renderArgs = seg.trimStart().replace(/^@render\s*/, '')
      const renderNode = parseDirective(`@render ${renderArgs}`, line, state, true) as RenderNode
      stages.push({ type: 'sink', node: renderNode })
    } else {
      const first = seg.trim().split(/\s+/)[0] ?? ''
      if (BUILTINS.has(first)) {
        stages.push({ type: 'builtin', command: seg.trim() })
      } else {
        stages.push({ type: 'shell', command: seg.trim() })
      }
    }
  }

  // If no explicit sink, add implicit sink (from as="type") or scalar stage
  const lastStage = stages[stages.length - 1]
  if (!lastStage || lastStage.type !== 'sink') {
    if (sourceAsType !== null) {
      const renderNode: RenderNode = { type: 'render', line, args: { type: sourceAsType } }
      stages.push({ type: 'sink', node: renderNode })
    } else {
      stages.push({ type: 'scalar' })
    }
  }

  return { type: 'pipe', line, stages }
}

function parseDirective(raw: string, line: number, state: State, inline = false): ASTNode {
  const trimmed = raw.trim()
  const spaceIdx = trimmed.indexOf(' ')
  const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1)
  const ctx: ParseContext = { line, filePath: state.filePath, inImport: state.inImport }
  const mod = getModule(name)
  if (!mod) {
    const pass: PassthroughNode = { type: 'passthrough', line, raw: trimmed }
    return pass
  }
  if (mod.block && !inline) {
    if (name === 'define') return parseDefineBlock(state, trimmed, line)
    if (name === 'phase') return parsePhaseBlock(state, trimmed, line)
    if (name === 'if') return parseIfBlock(state, args.trim(), line)
  }
  return mod.parse(trimmed, args, ctx)
}

function parseGraphBlock(state: State, line: number): GraphNode {
  const bodyLines: string[] = []
  while (state.pos < state.lines.length) {
    const raw = consume(state)
    if (raw.trim() === '```') break
    bodyLines.push(raw)
  }
  const mod = getModule('graph')!
  const ctx: ParseContext = { line, filePath: state.filePath, inImport: state.inImport }
  return mod.parse('', bodyLines.join('\n'), ctx) as GraphNode
}

function parseNextNode(state: State): ASTNode | null {
  const raw = consume(state)
  const line = state.pos  // already advanced
  const lineNumber = line  // 1-indexed since we incremented

  if (!raw.trim()) return makeMarkdown(raw, lineNumber)

  // Fenced code block
  if (raw.trimStart().startsWith('```')) {
    const lang = raw.trimStart().slice(3).trim()
    if (lang === 'mai-graph') return parseGraphBlock(state, lineNumber)
    // Regular fenced block: collect until closing ``` — immune to interpolation scanning
    const chunks = [raw]
    while (state.pos < state.lines.length) {
      const bodyLine = consume(state)
      chunks.push(bodyLine)
      if (bodyLine.trimStart().startsWith('```')) break
    }
    return { type: 'markdown' as const, line: lineNumber, text: chunks.join('\n'), interpolations: [] }
  }

  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('@')) return makeMarkdown(raw, lineNumber)

  // @on outside @phase is an error
  if (trimmed.startsWith('@on ')) {
    throw new ParseError('@on transition is only valid inside a @phase block', lineNumber, state.filePath)
  }

  // @render is only valid as the last stage of a pipe chain
  if (trimmed === '@render' || trimmed.startsWith('@render ')) {
    throw new ParseError('@render is only valid as the last stage of a pipe chain', lineNumber, state.filePath)
  }

  // Detect pipe line
  if (splitUnquotedPipe(trimmed).length > 1) {
    return parsePipeLine(trimmed, lineNumber, state)
  }

  const n = parseDirective(trimmed, lineNumber, state)
  const asType = extractAs(n)
  if (asType !== null) {
    const renderNode: RenderNode = { type: 'render', line: lineNumber, args: { type: asType } }
    return { type: 'pipe', line: lineNumber, stages: [{ type: 'source', node: n }, { type: 'sink', node: renderNode }] }
  }
  return n
}

export function parse(source: string, options?: ParseOptions): ParseResult {
  const filePath = options?.filePath ?? '<input>'
  const inImport = options?.inImport ?? false
  const lines = source.split('\n')
  const firstLine = lines[0]?.trim() ?? ''

  if (!firstLine.startsWith('@markdownai')) {
    return { isMarkdownAI: false, version: null, nodes: [] }
  }

  const vMatch = firstLine.match(/^@markdownai(?:\s+v(\d+\.\d+))?/)
  const version = vMatch?.[1] ?? null
  const header: HeaderNode = { type: 'header', line: 1, version }

  const state: State = { lines, pos: 1, filePath, inImport }
  const bodyNodes: ASTNode[] = []

  while (state.pos < state.lines.length) {
    const node = parseNextNode(state)
    if (node) bodyNodes.push(node)
  }

  return { isMarkdownAI: true, version, nodes: [header, ...bodyNodes] }
}
