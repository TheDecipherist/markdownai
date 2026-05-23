import type {
  ASTNode, MarkdownNode, TransitionNode, TransitionAction,
  PromptNode, ConstraintNode, NoteNode, GraphNode, ShellInlineSpan,
  RenderTemplateNode,
} from './types.js'
import { ParseError } from './types.js'

import { getModule } from './registry.js'
import { scanInterpolations } from './interpolation.js'
import { type State, lineNum, peek, consume } from './parser-state.js'

export function makeMarkdown(text: string, line: number, shellInlines: ShellInlineSpan[] = []): MarkdownNode {
  return { type: 'markdown', line, text, interpolations: scanInterpolations(text), shellInlines }
}

export function parseTransition(raw: string, line: number, filePath: string): TransitionNode {
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

export function parseTextBlock(
  state: State,
  openLine: string,
  args: string,
  line: number,
  name: 'prompt' | 'constraint',
): PromptNode | ConstraintNode {
  const mod = getModule(name)!
  const ctx = { line, filePath: state.filePath, inImport: state.inImport }
  const node = mod.parse(openLine, args, ctx) as PromptNode | ConstraintNode
  const bodyLines: string[] = []
  let textClosed = false
  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    if (raw.trim() === '@end') { consume(state); textClosed = true; break }
    bodyLines.push(consume(state))
  }
  if (!textClosed) throw new ParseError(`Unclosed @${name} block — expected @end`, line, state.filePath)
  node.body = bodyLines.join('\n').trim()
  return node
}

export function parseNoteBlock(state: State, openLine: string, args: string, line: number): NoteNode {
  const mod = getModule('note')!
  const ctx = { line, filePath: state.filePath, inImport: state.inImport }
  const node = mod.parse(openLine, args, ctx) as NoteNode
  const bodyLines: string[] = []
  let noteClosed = false
  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    if (raw.trim() === '@end') { consume(state); noteClosed = true; break }
    if (raw.trim().startsWith('@note')) throw new ParseError('nested @note is not supported', lineNum(state), state.filePath)
    bodyLines.push(consume(state))
  }
  if (!noteClosed) throw new ParseError(`Unclosed @note block — expected @end`, line, state.filePath)
  node.body = bodyLines.join('\n').trim()
  return node
}

export function parseRenderTemplateBlock(
  state: State,
  openLine: string,
  args: string,
  line: number,
): RenderTemplateNode {
  const mod = getModule('render-template')!
  const ctx = { line, filePath: state.filePath, inImport: state.inImport }
  const node = mod.parse(openLine, args, ctx) as RenderTemplateNode
  const params: Record<string, string> = {}
  let closed = false
  while (state.pos < state.lines.length) {
    const raw = peek(state)!
    if (raw.trim() === '@end') { consume(state); closed = true; break }
    consume(state)
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    params[key] = val
  }
  if (!closed) throw new ParseError('Unclosed @render-template block — expected @end', line, state.filePath)
  node.params = params
  return node
}

export function parseGraphBlock(state: State, line: number): GraphNode {
  const bodyLines: string[] = []
  let closed = false
  while (state.pos < state.lines.length) {
    const raw = consume(state)
    if (raw.trim() === '```') { closed = true; break }
    bodyLines.push(raw)
  }
  if (!closed) throw new ParseError('Unclosed mai-graph block — expected closing ```', line, state.filePath)
  const mod = getModule('graph')!
  const ctx = { line, filePath: state.filePath, inImport: state.inImport }
  return mod.parse('', bodyLines.join('\n'), ctx) as GraphNode
}
