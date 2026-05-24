import type {
  ASTNode, ParseResult, ParseOptions, ParseContext,
  HeaderNode, PassthroughNode, DefineNode,
  PhaseNode, ConditionalNode, ConditionalBranch, PipeNode, PipeStage,
  RenderNode, SectionNode, SwitchNode, SwitchCase,
} from './types.js'
import { ParseError } from './types.js'
import { getModule } from './registry.js'
import { scanShellInlines } from './interpolation.js'
import { splitUnquotedPipe } from './directives/pipe.js'
import { type State, lineNum, peek, consume } from './parser-state.js'
import { makeMarkdown, parseTransition, parseTextBlock, parseNoteBlock, parseGraphBlock, parseRenderTemplateBlock, parseForeachBlock } from './parser-blocks.js'

const BUILTINS = new Set(['grep', 'sort', 'head', 'tail', 'wc', 'uniq'])

function collectBody(state: State, closeTag: string): ASTNode[] {
  const nodes: ASTNode[] = []
  let bodyClosed = false
  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === `@${closeTag}`) { consume(state); bodyClosed = true; break }
    const node = parseNextNode(state)
    if (node) nodes.push(node)
  }
  if (!bodyClosed) throw new ParseError(`Unclosed block — expected @${closeTag}`, 0, state.filePath)
  return nodes
}

function extractAs(node: ASTNode): string | null {
  if ('args' in node && node.args !== null && typeof node.args === 'object' && !Array.isArray(node.args)) {
    const args = node.args as Record<string, string>
    const asType = args['as']
    if (typeof asType === 'string') { delete args['as']; return asType }
  }
  return null
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
  const transitions = []
  const body: ASTNode[] = []

  let phaseClosed = false
  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === '@end') { consume(state); phaseClosed = true; break }
    if (trimmed.startsWith('@on ')) {
      transitions.push(parseTransition(trimmed, lineNum(state), state.filePath))
      consume(state)
    } else {
      const child = parseNextNode(state)
      if (child) body.push(child)
    }
  }
  if (!phaseClosed) throw new ParseError(`Unclosed @phase block — expected @end`, line, state.filePath)
  node.body = body
  node.transitions = transitions
  return node
}

function parseIfBlock(state: State, condition: string, line: number): ConditionalNode {
  const branches: ConditionalBranch[] = [{ condition, body: [] }]
  let current = branches[0]!
  let ifClosed = false

  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === '@endif') { consume(state); ifClosed = true; break }
    if (trimmed.startsWith('@elseif ')) {
      branches.push({ condition: trimmed.replace(/^@elseif\s+/, ''), body: [] })
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
  if (!ifClosed) throw new ParseError(`Unclosed @if block — expected @endif`, line, state.filePath)
  return { type: 'conditional', line, branches }
}

function parseSwitchBlock(state: State, expression: string, line: number): SwitchNode {
  const cases: SwitchCase[] = []
  let defaultBody: ASTNode[] | null = null
  let current: ASTNode[] | null = null
  let switchClosed = false

  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    const trimmed = raw.trim()
    if (trimmed === '@endswitch') { consume(state); switchClosed = true; break }
    if (trimmed.startsWith('@case ')) {
      const caseExpr = trimmed.slice('@case '.length).trim()
      const newCase: SwitchCase = { caseExpression: caseExpr, body: [] }
      cases.push(newCase)
      current = newCase.body
      consume(state)
    } else if (trimmed === '@default') {
      defaultBody = []
      current = defaultBody
      consume(state)
    } else if (current !== null) {
      const child = parseNextNode(state)
      if (child) current.push(child)
    } else {
      consume(state)
    }
  }
  if (!switchClosed) throw new ParseError(`Unclosed @switch block — expected @endswitch`, line, state.filePath)
  return { type: 'switch', line, expression, cases, defaultBody }
}

function parseSectionBlock(state: State, openLine: string, line: number): SectionNode {
  const mod = getModule('section')!
  const args = openLine.replace(/^@section\s*/, '')
  const ctx: ParseContext = { line, filePath: state.filePath, inImport: state.inImport }
  const node = mod.parse(openLine, args, ctx) as SectionNode
  node.body = collectBody(state, 'end')
  return node
}

function parsePipeLine(raw: string, line: number, state: State): PipeNode {
  const segments = splitUnquotedPipe(raw)
  const stages: PipeStage[] = []
  let sourceAsType: string | null = null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const isLast = i === segments.length - 1
    if (i === 0) {
      const sourceNode = parseDirective(seg.trim(), line, state, true)
      sourceAsType = extractAs(sourceNode)
      stages.push({ type: 'source', node: sourceNode })
    } else if (isLast && seg.trimStart().startsWith('@render')) {
      const renderArgs = seg.trimStart().replace(/^@render\s*/, '')
      const renderNode = parseDirective(`@render ${renderArgs}`, line, state, true) as RenderNode
      stages.push({ type: 'sink', node: renderNode })
    } else {
      const first = seg.trim().split(/\s+/)[0] ?? ''
      stages.push(BUILTINS.has(first) ? { type: 'builtin', command: seg.trim() } : { type: 'shell', command: seg.trim() })
    }
  }

  const lastStage = stages[stages.length - 1]
  if (!lastStage || lastStage.type !== 'sink') {
    if (sourceAsType !== null) {
      stages.push({ type: 'sink', node: { type: 'render', line, args: { type: sourceAsType } } })
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
  if (!mod) return { type: 'passthrough', line, raw: trimmed } as PassthroughNode
  if (mod.block && !inline) {
    if (name === 'define') return parseDefineBlock(state, trimmed, line)
    if (name === 'phase') return parsePhaseBlock(state, trimmed, line)
    if (name === 'if') return parseIfBlock(state, args.trim(), line)
    if (name === 'section') return parseSectionBlock(state, trimmed, line)
    if (name === 'prompt') return parseTextBlock(state, trimmed, args, line, 'prompt')
    if (name === 'constraint') return parseTextBlock(state, trimmed, args, line, 'constraint')
    if (name === 'note') return parseNoteBlock(state, trimmed, args, line)
    if (name === 'render-template') return parseRenderTemplateBlock(state, trimmed, args, line)
    if (name === 'foreach') return parseForeachBlock(state, trimmed, args, line, collectBody)
    if (name === 'switch') return parseSwitchBlock(state, args.trim(), line)
    throw new ParseError(`@${name} is a block directive but has no block parser registered`, line, state.filePath)
  }
  return mod.parse(trimmed, args, ctx)
}

function parseNextNode(state: State): ASTNode | null {
  const raw = consume(state)
  const lineNumber = state.pos

  if (!raw.trim()) return makeMarkdown(raw, lineNumber)

  if (raw.trimStart().startsWith('```')) {
    const lang = raw.trimStart().slice(3).trim()
    if (lang === 'mai-graph') return parseGraphBlock(state, lineNumber)
    const chunks = [raw]
    while (state.pos < state.lines.length) {
      const bodyLine = consume(state)
      chunks.push(bodyLine)
      if (bodyLine.trimStart().startsWith('```')) break
    }
    return { type: 'markdown' as const, line: lineNumber, text: chunks.join('\n'), interpolations: [], shellInlines: [] }
  }

  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('@')) {
    const shellInlines = state.shellInlinePassthrough ? [] : scanShellInlines(raw)
    return makeMarkdown(raw, lineNumber, shellInlines)
  }
  if (trimmed.startsWith('@on ')) throw new ParseError('@on transition is only valid inside a @phase block', lineNumber, state.filePath)
  if (trimmed === '@render' || trimmed.startsWith('@render ')) throw new ParseError('@render is only valid as the last stage of a pipe chain', lineNumber, state.filePath)
  if (splitUnquotedPipe(trimmed).length > 1) return parsePipeLine(trimmed, lineNumber, state)

  const n = parseDirective(trimmed, lineNumber, state)
  const asType = extractAs(n)
  if (asType !== null) {
    return { type: 'pipe', line: lineNumber, stages: [{ type: 'source', node: n }, { type: 'sink', node: { type: 'render', line: lineNumber, args: { type: asType } } }] }
  }
  return n
}

export function parse(source: string, options?: ParseOptions): ParseResult {
  const filePath = options?.filePath ?? '<input>'
  const inImport = options?.inImport ?? false
  const lines = source.split('\n')

  let startPos = 0
  const frontmatterNodes: ASTNode[] = []

  if (lines[0]?.trim() === '---') {
    let closeIdx = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') { closeIdx = i; break }
    }
    if (closeIdx !== -1) {
      for (let i = 0; i <= closeIdx; i++) frontmatterNodes.push(makeMarkdown(lines[i] ?? '', i + 1))
      startPos = closeIdx + 1
      while (startPos < lines.length && lines[startPos]?.trim() === '') {
        frontmatterNodes.push(makeMarkdown(lines[startPos] ?? '', startPos + 1))
        startPos++
      }
    }
  }

  const firstLine = lines[startPos]?.trim() ?? ''
  if (!firstLine.startsWith('@markdownai')) return { isMarkdownAI: false, version: null, nodes: [] }

  const vMatch = firstLine.match(/^@markdownai(?:\s+v(\d+\.\d+))?/)
  const version = vMatch?.[1] ?? null
  const header: HeaderNode = { type: 'header', line: startPos + 1, version }
  const shellInlinePassthrough = firstLine.includes('shell-inline="passthrough"')
  const state: State = { lines, pos: startPos + 1, filePath, inImport, shellInlinePassthrough }
  const bodyNodes: ASTNode[] = []

  while (state.pos < state.lines.length) {
    const node = parseNextNode(state)
    if (node) bodyNodes.push(node)
  }

  return { isMarkdownAI: true, version, nodes: [...frontmatterNodes, header, ...bodyNodes] }
}
