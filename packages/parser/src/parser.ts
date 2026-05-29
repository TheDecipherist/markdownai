import type {
  ASTNode, ParseResult, ParseOptions, ParseContext, DirectiveInput,
  HeaderNode, PassthroughNode, DefineNode, TransitionNode,
  PhaseNode, ConditionalNode, ConditionalBranch, PipeNode, PipeStage,
  RenderNode, SectionNode, SwitchNode, SwitchCase,
  ForeachNode, PromptNode, ConstraintNode, NoteNode,
  RenderTemplateNode,
  PluginMetaNode, PluginDetectNode, PluginLayoutNode, PluginConventionsNode,
  MarkdownNode, ShellInlineSpan, GraphNode,
} from './types.js'
import { ParseError } from './types.js'
import { getModule } from './registry.js'
import { scanInterpolations, scanShellInlines } from './interpolation.js'
import { splitUnquotedPipe } from './directives/pipe.js'

const BUILTINS = new Set(['grep', 'sort', 'head', 'tail', 'wc', 'uniq'])

// Mid-block directives that act as sub-clauses of a parent block.
// They don't carry their own close tag — the parent's `@<name>-end` ends them.
const IF_MID_DIRECTIVES = new Set(['elseif', 'else'])
const SWITCH_MID_DIRECTIVES = new Set(['case', 'default'])

// Names of legacy v1 close tags that v2 must reject with a clear error.
const V1_CLOSE_TAGS = new Set(['end', 'endif', 'endswitch'])

// Directives whose body should be parsed as raw text (joined into a single
// string) rather than recursively re-parsed.
const RAW_BODY_DIRECTIVES = new Set([
  'prompt', 'constraint', 'note',
  'plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions',
])

// Directives whose body lines are key=value pairs for params (currently just
// @render-template).
const PARAM_BODY_DIRECTIVES = new Set(['render-template'])

// Directives that opt out of the attr/body split entirely — every line after
// the opener is treated as a body line, preserving quote shape and any other
// detail that would be lost if the parser pre-consumed key=value lines as
// attrs. @data needs this so its <key> = <expression> body is delivered to the
// directive parser verbatim.
const VERBATIM_BODY_DIRECTIVES = new Set(['data'])

// Block directives that get their body recursively parsed into ASTNodes.
const RECURSIVE_BODY_DIRECTIVES = new Set([
  'phase', 'define', 'if', 'switch', 'foreach', 'section',
])

interface DirectiveOpener {
  name: string
  rawArgs: string
  positional: string
  attrs: Record<string, string>
  flags: string[]
  isSelfClosed: boolean
  indent: number
  lineIdx: number
}

const ATTR_REGEX = /^\s+([a-zA-Z_][a-zA-Z0-9_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s=]+)))?\s*$/
const OPENER_NAME_REGEX = /^@([a-zA-Z][a-zA-Z0-9_-]*)(?:\b|$)/

function leadingIndent(line: string): number {
  const m = line.match(/^[ \t]*/)
  return m ? m[0].length : 0
}

function isBlankOrWhitespace(line: string | undefined): boolean {
  return line === undefined || line.trim() === ''
}

/**
 * Tokenize the opener line's argument text into (positional, attrs, flags).
 *
 *   `@db using="mdd" find="features"`           → positional='', attrs={using,find}
 *   `@phase 0_branch_check required=true`       → positional='0_branch_check', attrs={required:true}
 *   `@touch "src/file.ts"`                       → positional='src/file.ts', attrs={}
 *   `@event build-start data='{"a":1}'`         → positional='build-start', attrs={data}
 *
 * The first whitespace-separated token that does NOT look like a `name=value`
 * attribute is treated as positional. Subsequent tokens are parsed as attrs
 * or flags. Quoted values may contain spaces; we tokenize with quote-awareness.
 */
function tokenizeOpener(argText: string): { positional: string; attrs: Record<string, string>; flags: string[] } {
  const tokens = quoteAwareSplit(argText)
  const attrs: Record<string, string> = {}
  const flags: string[] = []
  let positional = ''
  let positionalSet = false

  for (const tok of tokens) {
    const eqIdx = findUnquotedEq(tok)
    if (eqIdx > 0) {
      const key = tok.slice(0, eqIdx).trim()
      let val = tok.slice(eqIdx + 1).trim()
      val = stripQuotes(val)
      // Identifier-shaped key → attribute. Otherwise it's still positional
      // (e.g. an interpolation containing `=` or a path like `a/b=c`).
      if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
        attrs[key] = val
        continue
      }
    }
    // Bare token: first one becomes positional (unquoted), rest become flags.
    if (!positionalSet) {
      positional = stripQuotes(tok)
      positionalSet = true
    } else {
      flags.push(stripQuotes(tok))
    }
  }

  return { positional, attrs, flags }
}

function stripQuotes(s: string): string {
  if (s.length >= 2) {
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1)
  }
  return s
}

function findUnquotedEq(tok: string): number {
  let inD = false, inS = false, braceDepth = 0
  for (let i = 0; i < tok.length; i++) {
    const ch = tok[i]!
    const next = tok[i + 1]
    if (inD) { if (ch === '"') inD = false; continue }
    if (inS) { if (ch === "'") inS = false; continue }
    if (ch === '"') { inD = true; continue }
    if (ch === "'") { inS = true; continue }
    if (ch === '{' && next === '{') { braceDepth++; i++; continue }
    if (ch === '}' && next === '}') { braceDepth--; i++; continue }
    if (braceDepth > 0) continue
    if (ch === '=') return i
  }
  return -1
}

function quoteAwareSplit(str: string): string[] {
  const out: string[] = []
  let cur = ''
  let inD = false, inS = false
  let braceDepth = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]!
    const next = str[i + 1]
    if (inD) { cur += ch; if (ch === '"') inD = false; continue }
    if (inS) { cur += ch; if (ch === "'") inS = false; continue }
    if (braceDepth > 0) {
      cur += ch
      if (ch === '{' && next === '{') { braceDepth++; cur += '{'; i++ }
      else if (ch === '}' && next === '}') { braceDepth--; cur += '}'; i++ }
      continue
    }
    if (ch === '"') { inD = true; cur += ch; continue }
    if (ch === "'") { inS = true; cur += ch; continue }
    if (ch === '{' && next === '{') { braceDepth++; cur += '{{'; i++; continue }
    if (ch === ' ' || ch === '\t') {
      if (cur) { out.push(cur); cur = '' }
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/**
 * Try to parse the opener line. Returns null if the line is not a directive opener.
 */
function tryParseOpener(line: string, lineIdx: number): DirectiveOpener | null {
  const trimmed = line.trimStart()
  if (!trimmed.startsWith('@')) return null
  const m = trimmed.match(OPENER_NAME_REGEX)
  if (!m) return null
  const name = m[1]!
  // Don't treat `@end`, `@endif`, `@endswitch` as openers — they're v1 close tags.
  // Don't treat `@<name>-end` as an opener — it's a v2 close tag.
  if (V1_CLOSE_TAGS.has(name)) return null
  if (name.endsWith('-end')) return null

  const afterName = trimmed.slice(m[0].length)
  // Self-close detection: trimmed line ends with ` /` (a space then a slash
  // at the very end). The slash must be the last non-whitespace character.
  let isSelfClosed = false
  let rawArgs = afterName
  const trailing = rawArgs.replace(/\s+$/, '')
  if (/\s\/$/.test(trailing) || trailing === '/') {
    isSelfClosed = true
    rawArgs = trailing.replace(/\s*\/$/, '').trim()
  } else {
    rawArgs = afterName.trim()
  }

  const { positional, attrs, flags } = tokenizeOpener(rawArgs)
  return {
    name, rawArgs, positional, attrs, flags, isSelfClosed,
    indent: leadingIndent(line),
    lineIdx,
  }
}

/**
 * Walk continuation lines after an opener that didn't self-close. Returns the
 * (attrs, flags, body lines, closeLineIdx). Throws if no matching close tag found.
 *
 * Rules:
 *   - close tag is `@<name>-end` at any indent level (we tolerate indent ≤ opener)
 *   - continuation lines must be indented strictly more than the opener line
 *     to be considered part of the block (a less-indented line that is not a
 *     close tag is an error)
 *   - attr lines (matching ATTR_REGEX) are collected as attrs until either:
 *       - a blank line is seen → body starts (blank itself dropped from body)
 *       - a `>` line is seen   → body starts (`>` itself dropped from body)
 *       - a non-attr-shaped line is seen → body starts (line itself becomes
 *         the first body line)
 *   - once body starts, all subsequent lines (until close) go into body
 *     verbatim, even if they look attr-shaped
 */
function collectBlock(
  lines: string[],
  opener: DirectiveOpener,
  filePath: string,
): { attrs: Record<string, string>; flags: string[]; body: string[]; closeLineIdx: number } {
  const closeTag = `@${opener.name}-end`
  // Detect same-name nested openers to track depth so e.g. an inner `@if`
  // doesn't have its `@if-end` mis-matched against the outer `@if`'s close.
  // Pattern: `@<name>` followed by whitespace, EOL, or `/` (but NOT `-end`
  // and NOT `-` which would be a different directive like `@if-foo`).
  const openerRegex = new RegExp(`^@${opener.name}(?=[\\s/]|$)`)
  const attrs: Record<string, string> = { ...opener.attrs }
  const flags: string[] = [...opener.flags]
  const body: string[] = []
  // Verbatim-body directives skip the attr/body split — every continuation
  // line goes straight to body. inBody starts true so the attr-collection
  // branch never fires.
  let inBody = VERBATIM_BODY_DIRECTIVES.has(opener.name)
  let depth = 1
  let i = opener.lineIdx + 1
  let closeIdx = -1

  while (i < lines.length) {
    const raw = lines[i]!
    const trimmed = raw.trim()

    // Close tag detection with depth tracking. When the close matches we pop
    // a level; only when depth returns to 0 is THIS block's close.
    if (trimmed === closeTag) {
      depth--
      if (depth === 0) { closeIdx = i; break }
      // Inner same-name block's close — keep collecting as body
      body.push(raw)
      i++
      continue
    }
    // Same-name nested opener bumps depth (skip self-closed `@<name> ... /`).
    if (openerRegex.test(trimmed) && !/\s\/$/.test(trimmed)) {
      depth++
      // Falls through to the body-collection logic below
    }
    // Blank line: in attr phase, blank line terminates attrs (does not become
    // part of body). In body phase, blank line is preserved as body.
    if (trimmed === '') {
      if (!inBody) {
        inBody = true
      } else {
        body.push(raw)
      }
      i++
      continue
    }

    // `>` line: explicit attrs/body separator. Only meaningful in attr phase
    // (in body phase, `>` is a markdown blockquote and stays in body).
    if (!inBody && trimmed === '>') {
      inBody = true
      i++
      continue
    }

    // Indent check: a non-blank line at or below the opener's indent that
    // isn't a close tag is treated as an unclosed-block error (we ran past
    // the block's natural boundary). For tolerance, accept any indent here —
    // some authors don't indent continuation lines deeply. Real-world v2
    // documents indent body content by 2 spaces; we don't enforce strictly.

    // v1 close-tag rejection: applies in both attr and body phases. A bare
    // `@end` / `@endif` / `@endswitch` on its own line inside a v2 block is
    // always a migration error — including inside verbatim-body directives
    // like @data where there is no attr phase.
    if (V1_CLOSE_TAGS.has(trimmed.slice(1)) && trimmed.startsWith('@')) {
      throw new ParseError(
        `v1 close tag "${trimmed}" not accepted in v2 — use "${closeTag}" instead`,
        i + 1, filePath,
      )
    }

    if (!inBody) {
      const m = raw.match(ATTR_REGEX)
      if (m) {
        const key = m[1]!
        const val = m[2] ?? m[3] ?? m[4] ?? ''
        attrs[key] = val
        // bare flag: name only with no `=`
        if (m[2] === undefined && m[3] === undefined && m[4] === undefined) {
          flags.push(key)
        }
        i++
        continue
      }
      // Not attr-shaped → body starts here, this line is the first body line.
      inBody = true
      body.push(raw)
      i++
      continue
    }

    // In body phase: collect verbatim.
    body.push(raw)
    i++
  }

  if (closeIdx === -1) {
    throw new ParseError(
      `Unclosed block — expected ${closeTag}`,
      opener.lineIdx + 1, filePath
    )
  }
  return { attrs, flags, body, closeLineIdx: closeIdx }
}

function makeMarkdown(text: string, line: number, shellInlines: ShellInlineSpan[] = []): MarkdownNode {
  return { type: 'markdown', line, text, interpolations: scanInterpolations(text), shellInlines }
}

function extractAs(node: ASTNode): string | null {
  if ('args' in node && node.args !== null && typeof node.args === 'object' && !Array.isArray(node.args)) {
    const args = node.args as Record<string, string>
    const asType = args['as']
    if (typeof asType === 'string') { delete args['as']; return asType }
  }
  return null
}

function populateRecursiveBody(
  node: ASTNode,
  bodyLines: string[],
  opener: DirectiveOpener,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  // The body lines are absolute line text (no leading-indent stripping). We
  // re-parse them using parseNodes() starting at line index (opener.lineIdx + N)
  // where N is the offset of the first body line within the block. For line-number
  // accuracy, we reconstruct a sub-lines array offset by opener.lineIdx + 1.
  // Simpler: just re-parse the body lines as a standalone source, tracking the
  // base line offset.
  switch (opener.name) {
    case 'phase':
      parsePhaseBody(node as PhaseNode, bodyLines, opener.lineIdx + 1, filePath, inImport, blockStack)
      break
    case 'define':
      parseDefineBody(node as DefineNode, bodyLines, opener.lineIdx + 1, filePath, inImport, blockStack)
      break
    case 'if':
      parseIfBody(node as ConditionalNode, bodyLines, opener.lineIdx + 1, filePath, inImport, blockStack)
      break
    case 'switch':
      parseSwitchBody(node as SwitchNode, bodyLines, opener.lineIdx + 1, filePath, inImport, blockStack)
      break
    case 'foreach':
      parseForeachBody(node as ForeachNode, bodyLines, opener.lineIdx + 1, filePath, inImport, blockStack)
      break
    case 'section':
      parseSectionBody(node as SectionNode, bodyLines, opener.lineIdx + 1, filePath, inImport, blockStack)
      break
  }
}

function parseBodyAsNodes(
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): ASTNode[] {
  return parseNodes(bodyLines, 0, baseLineNum, filePath, inImport, blockStack).nodes
}

function parsePhaseBody(
  node: PhaseNode,
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  blockStack.push('phase')
  try {
    const result = parseNodes(bodyLines, 0, baseLineNum, filePath, inImport, blockStack)
    const transitions: TransitionNode[] = []
    const body: ASTNode[] = []
    for (const child of result.nodes) {
      if (child.type === 'transition') transitions.push(child)
      else body.push(child)
    }
    node.body = body
    node.transitions = transitions
  } finally {
    blockStack.pop()
  }
}

function parseDefineBody(
  node: DefineNode,
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  blockStack.push('define')
  try {
    const result = parseNodes(bodyLines, 0, baseLineNum, filePath, inImport, blockStack)
    const transitions: TransitionNode[] = []
    const body: ASTNode[] = []
    for (const child of result.nodes) {
      if (child.type === 'transition') transitions.push(child)
      else body.push(child)
    }
    node.body = body
    node.transitions = transitions
  } finally {
    blockStack.pop()
  }
}

function parseIfBody(
  node: ConditionalNode,
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  // The opener line set up branches[0] = { condition: <expr>, body: [] }.
  // Walk body lines: top-level @elseif/@else lines split into new branches.
  // Other lines parse via parseNodes into the current branch.
  let pos = 0
  let current = node.branches[0]!
  while (pos < bodyLines.length) {
    const raw = bodyLines[pos]!
    const trimmed = raw.trim()
    if (trimmed.startsWith('@elseif ') || trimmed === '@elseif') {
      const cond = trimmed.replace(/^@elseif\s*/, '').trim()
      node.branches.push({ condition: cond, body: [] })
      current = node.branches[node.branches.length - 1]!
      pos++
      continue
    }
    if (trimmed === '@else' || trimmed.startsWith('@else ') || trimmed === '@else /') {
      node.branches.push({ condition: null, body: [] })
      current = node.branches[node.branches.length - 1]!
      pos++
      continue
    }
    // Parse one node starting at pos, append to current branch
    const { nodes, consumed } = parseNodes(bodyLines, pos, baseLineNum, filePath, inImport, blockStack, /* singleStep */ true)
    for (const n of nodes) current.body.push(n)
    pos += consumed
    if (consumed === 0) pos++  // safety against infinite loop
  }
}

function parseSwitchBody(
  node: SwitchNode,
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  let pos = 0
  let current: ASTNode[] | null = null
  while (pos < bodyLines.length) {
    const raw = bodyLines[pos]!
    const trimmed = raw.trim()
    if (trimmed.startsWith('@case ') || trimmed === '@case') {
      const expr = trimmed.replace(/^@case\s*/, '').trim()
      const newCase: SwitchCase = { caseExpression: expr, body: [] }
      node.cases.push(newCase)
      current = newCase.body
      pos++
      continue
    }
    if (trimmed === '@default' || trimmed.startsWith('@default ') || trimmed === '@default /') {
      node.defaultBody = []
      current = node.defaultBody
      pos++
      continue
    }
    if (current === null) {
      // Lines before first @case are ignored (whitespace etc.)
      pos++
      continue
    }
    const { nodes, consumed } = parseNodes(bodyLines, pos, baseLineNum, filePath, inImport, blockStack, true)
    for (const n of nodes) current.push(n)
    pos += consumed
    if (consumed === 0) pos++
  }
}

function parseForeachBody(
  node: ForeachNode,
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  node.body = parseBodyAsNodes(bodyLines, baseLineNum, filePath, inImport, blockStack)
}

function parseSectionBody(
  node: SectionNode,
  bodyLines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): void {
  node.body = parseBodyAsNodes(bodyLines, baseLineNum, filePath, inImport, blockStack)
}

/**
 * Parse a range of lines into AST nodes. Returns { nodes, consumed }.
 *
 * If `singleStep` is true, returns after the first node has been emitted —
 * used by mid-block walkers (if/switch) so they can interleave node parsing
 * with mid-block directive detection.
 */
function parseNodes(
  lines: string[],
  startIdx: number,
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
  singleStep = false,
): { nodes: ASTNode[]; consumed: number } {
  const nodes: ASTNode[] = []
  let i = startIdx
  while (i < lines.length) {
    const raw = lines[i]!
    const trimmed = raw.trim()
    const lineNum = baseLineNum + i

    // Blank line
    if (trimmed === '') {
      nodes.push(makeMarkdown(raw, lineNum))
      i++
      if (singleStep) break
      continue
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      if (lang === 'mai-graph') {
        const startLine = lineNum
        const chunks: string[] = []
        i++
        let closed = false
        while (i < lines.length) {
          const inner = lines[i]!
          if (inner.trim() === '```') { closed = true; i++; break }
          chunks.push(inner)
          i++
        }
        if (!closed) throw new ParseError('Unclosed mai-graph block — expected closing ```', startLine, filePath)
        const mod = getModule('graph')!
        const ctx: ParseContext = { line: startLine, filePath, inImport }
        const input: DirectiveInput = {
          positional: chunks.join('\n'),
          attrs: {},
          flags: [],
          body: [],
          isSelfClosed: false,
          line: startLine,
          rawArgs: chunks.join('\n'),
        }
        nodes.push(mod.parse(input, ctx))
        if (singleStep) break
        continue
      }
      const collected = [raw]
      i++
      while (i < lines.length) {
        const inner = lines[i]!
        collected.push(inner)
        i++
        if (inner.trim().startsWith('```')) break
      }
      nodes.push({ type: 'markdown', line: lineNum, text: collected.join('\n'), interpolations: [], shellInlines: [] })
      if (singleStep) break
      continue
    }

    // Plain text line — not a directive
    if (!raw.trimStart().startsWith('@')) {
      const shellInlines = scanShellInlines(raw)
      nodes.push(makeMarkdown(raw, lineNum, shellInlines))
      i++
      if (singleStep) break
      continue
    }

    // Directive line: detect opener
    const opener = tryParseOpener(raw, i)
    if (!opener) {
      // Could be a v1 close tag at top level — already-thrown by collectBlock
      // when inside a block. At top level, treat as passthrough text.
      const t = trimmed
      if (V1_CLOSE_TAGS.has(t.slice(1)) && t.startsWith('@')) {
        throw new ParseError(
          `v1 close tag "${t}" not accepted in v2 — use "@<name>-end" instead`,
          lineNum, filePath
        )
      }
      // Bare `@on complete -> ...` (v1) → reject
      if (t.startsWith('@on ')) {
        throw new ParseError(
          `v1 transition syntax "@on complete -> ..." not accepted in v2 — use "@on-complete <target> /" instead`,
          lineNum, filePath
        )
      }
      // Some other @-prefixed line we couldn't parse → passthrough
      nodes.push({ type: 'passthrough', line: lineNum, raw } as PassthroughNode)
      i++
      if (singleStep) break
      continue
    }

    // Override opener.lineIdx to be relative-to-lines (it already is)
    // and adjust the ctx.line by baseLineNum.
    const adjustedOpener: DirectiveOpener = { ...opener, lineIdx: i }
    // Reject v1 transition syntax explicitly even if name='on' parses.
    if (opener.name === 'on') {
      throw new ParseError(
        `v1 transition syntax "@on ..." not accepted in v2 — use "@on-complete <target> /"`,
        lineNum, filePath
      )
    }

    // Pipe detection on the opener line: if the line has unquoted `|`, parse
    // as a pipe. Pipes can only appear on a single source-line (not block-form).
    if (splitUnquotedPipe(raw.trimStart()).length > 1) {
      const pipeNode = parsePipeLine(raw.trimStart(), lineNum, filePath, inImport, blockStack)
      nodes.push(pipeNode)
      i++
      if (singleStep) break
      continue
    }

    // Standard directive parse
    const { node, nextLineIdx } = parseDirectiveAtOpenerWithBase(
      adjustedOpener, lines, baseLineNum, filePath, inImport, blockStack
    )

    // Auto-wrap data-source directives whose `as=` declares a render type.
    const asType = extractAs(node)
    const LABEL_AS_DIRECTIVES = new Set(['call', 'markdownai-detect', 'plugin-data'])
    if (asType !== null && !LABEL_AS_DIRECTIVES.has(node.type)) {
      const wrapped: PipeNode = {
        type: 'pipe', line: lineNum,
        stages: [
          { type: 'source', node },
          { type: 'sink', node: { type: 'render', line: lineNum, args: { type: asType } } },
        ],
      }
      nodes.push(wrapped)
    } else {
      nodes.push(node)
    }

    i = nextLineIdx
    if (singleStep) break
  }
  return { nodes, consumed: i - startIdx }
}

function parseDirectiveAtOpenerWithBase(
  opener: DirectiveOpener,
  lines: string[],
  baseLineNum: number,
  filePath: string,
  inImport: boolean,
  blockStack: string[],
): { node: ASTNode; nextLineIdx: number } {
  // opener.lineIdx is the index INTO `lines`. ctx.line for the directive is
  // baseLineNum + opener.lineIdx.
  const ctxLine = baseLineNum + opener.lineIdx
  const ctx: ParseContext = { line: ctxLine, filePath, inImport }
  const mod = getModule(opener.name)

  if (opener.isSelfClosed) {
    const input: DirectiveInput = {
      positional: opener.positional,
      attrs: opener.attrs,
      flags: opener.flags,
      body: [],
      isSelfClosed: true,
      line: ctxLine,
      rawArgs: opener.rawArgs,
    }
    if (!mod) {
      return { node: { type: 'passthrough', line: ctxLine, raw: lines[opener.lineIdx] ?? '' } as PassthroughNode, nextLineIdx: opener.lineIdx + 1 }
    }
    if (opener.name === 'on-complete' && blockStack.length === 0) {
      throw new ParseError('@on-complete is only valid inside a @phase or @define block', ctxLine, filePath)
    }
    return { node: mod.parse(input, ctx), nextLineIdx: opener.lineIdx + 1 }
  }

  if (opener.name === 'phase' && inImport) {
    throw new ParseError('@phase is not valid in @import context', ctxLine, filePath)
  }

  const { attrs, flags, body, closeLineIdx } = collectBlock(lines, opener, filePath)
  const input: DirectiveInput = {
    positional: opener.positional,
    attrs,
    flags,
    body,
    isSelfClosed: false,
    line: ctxLine,
    rawArgs: opener.rawArgs,
  }
  if (!mod) {
    return { node: { type: 'passthrough', line: ctxLine, raw: lines[opener.lineIdx] ?? '' } as PassthroughNode, nextLineIdx: closeLineIdx + 1 }
  }
  const node = mod.parse(input, ctx)
  if (RECURSIVE_BODY_DIRECTIVES.has(opener.name)) {
    populateRecursiveBody(node, body, opener, filePath, inImport, blockStack)
  }
  return { node, nextLineIdx: closeLineIdx + 1 }
}

function parsePipeLine(
  rawLine: string,
  lineNum: number,
  filePath: string,
  inImport: boolean,
  _blockStack: string[],
): PipeNode {
  const segments = splitUnquotedPipe(rawLine)
  const stages: PipeStage[] = []
  let sourceAsType: string | null = null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const isLast = i === segments.length - 1
    if (i === 0) {
      const sourceNode = parseInlineDirective(seg.trim(), lineNum, filePath, inImport)
      sourceAsType = extractAs(sourceNode)
      stages.push({ type: 'source', node: sourceNode })
    } else if (isLast && seg.trimStart().startsWith('@render')) {
      const renderArgs = seg.trimStart().replace(/^@render\s*/, '')
      const renderNode = parseInlineDirective(`@render ${renderArgs}`, lineNum, filePath, inImport) as RenderNode
      stages.push({ type: 'sink', node: renderNode })
    } else {
      const first = seg.trim().split(/\s+/)[0] ?? ''
      stages.push(BUILTINS.has(first) ? { type: 'builtin', command: seg.trim() } : { type: 'shell', command: seg.trim() })
    }
  }

  const lastStage = stages[stages.length - 1]
  if (!lastStage || lastStage.type !== 'sink') {
    if (sourceAsType !== null) {
      stages.push({ type: 'sink', node: { type: 'render', line: lineNum, args: { type: sourceAsType } } })
    } else {
      stages.push({ type: 'scalar' })
    }
  }

  return { type: 'pipe', line: lineNum, stages }
}

/**
 * Parse a single-line directive (no block continuations). Used for pipe stages
 * and any other context where the directive is known to be inline.
 *
 * The directive may or may not end in ` /` — either form is treated as
 * complete on this line.
 */
function parseInlineDirective(rawLine: string, lineNum: number, filePath: string, inImport: boolean): ASTNode {
  const opener = tryParseOpener(rawLine, 0)
  if (!opener) {
    return { type: 'passthrough', line: lineNum, raw: rawLine } as PassthroughNode
  }
  const ctx: ParseContext = { line: lineNum, filePath, inImport }
  const mod = getModule(opener.name)
  const input: DirectiveInput = {
    positional: opener.positional,
    attrs: opener.attrs,
    flags: opener.flags,
    body: [],
    isSelfClosed: opener.isSelfClosed,
    line: lineNum,
    rawArgs: opener.rawArgs,
  }
  if (!mod) {
    return { type: 'passthrough', line: lineNum, raw: rawLine } as PassthroughNode
  }
  return mod.parse(input, ctx)
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

  // Parse everything after the header.
  const rest = lines.slice(startPos + 1)
  const baseLineNum = startPos + 2  // 1-based line number of first non-header line
  const { nodes: bodyNodes } = parseNodes(rest, 0, baseLineNum, filePath, inImport, [])

  return { isMarkdownAI: true, version, nodes: [...frontmatterNodes, header, ...bodyNodes] }
}
