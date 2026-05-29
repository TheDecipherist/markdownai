// Iteration directives — @foreach and @set.
//
// @foreach runs the source expression once, splits the result into items,
// and re-walks the body once per item with the iteration variable bound in
// ctx.envFiles. Items are split on newlines (matching how @list / @read /
// @query return data) and on commas (matching how @read-frontmatter returns
// list-typed fields).
//
// @set evaluates an expression on the right of `=` and stores the result in
// ctx.envFiles[varName]. The RHS can be a literal, a `{{ interpolation }}`,
// or a directive call (in which case the result is the directive's output).

import type { ASTNode, ForeachNode, SetNode, InterpolationSpan, ShellInlineSpan } from '@markdownai/parser'
import { parse as parserParse, scanInterpolations } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { substituteParams } from './macros.js'
import { evalExpressionTyped } from './conditions.js'

type WalkFn = (nodes: ASTNode[], ctx: EngineContext) => string[]
type ResolveInterpFn = (text: string, spans: InterpolationSpan[], ctx: EngineContext, shellInlines?: ShellInlineSpan[]) => string

let _walk: WalkFn | null = null
let _resolveInterp: ResolveInterpFn | null = null

/** Engine injects its own walkNodes + interpolation evaluator at module init. */
export function setIterEngine(walk: WalkFn, resolveInterp: ResolveInterpFn): void {
  _walk = walk
  _resolveInterp = resolveInterp
}

function splitItems(raw: string): string[] {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '') return []
  // JSON array shape FIRST — `[a, b, c]` or pretty-printed
  // `[\n  "a",\n  "b"\n]`. The interpolation sandbox JSON.stringify's arrays
  // with indent=2 so they reach here with newlines; without this branch
  // running first, the newline-split below treats `[`, `"a",`, `]` as
  // separate items. Try real JSON.parse before the fallback bracket-strip
  // so quoted strings round-trip cleanly even when they contain commas.
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(v => String(v)).filter(s => s !== '')
    } catch { /* fall through to manual bracket strip */ }
    return trimmed
      .slice(1, -1)
      .split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(s => s !== '')
  }
  // Newline-separated (the natural output of @list, @read, @query).
  if (trimmed.includes('\n')) {
    return trimmed.split('\n').map(s => s.trim()).filter(s => s !== '')
  }
  // Comma-separated list (e.g. @read-frontmatter list field).
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(s => s.trim()).filter(s => s !== '')
  }
  // Single scalar — treat as one-item list.
  return [trimmed]
}

export function evaluateSource(literal: string, ctx: EngineContext): string {
  if (!_walk || !_resolveInterp) return ''
  const trimmed = literal.trim()
  if (trimmed === '') return ''
  // If the literal starts with `@`, parse and execute it as a sub-directive.
  if (trimmed.startsWith('@')) {
    // v2 inline directives need a trailing ` /` self-close. The literal here
    // is a single-line directive expression (e.g. `@list ./docs/ match="*.md"`)
    // — add ` /` if not already present.
    const needsSlash = !/\s\/\s*$/.test(trimmed)
    const dir = needsSlash ? `${trimmed} /` : trimmed
    const wrapper = `@markdownai v1.0\n${dir}\n`
    const ast = parserParse(wrapper)
    const bodyNodes = ast.nodes.filter(n => n.type !== 'header' && n.type !== 'markdown')
    if (bodyNodes.length === 0) return ''
    return _walk(bodyNodes, ctx).join('\n').trim()
  }
  // Otherwise treat as text with `{{ }}` interpolation support.
  const spans = scanInterpolations(trimmed)
  return _resolveInterp(trimmed, spans, ctx, [])
}

export function executeForeach(node: ForeachNode, ctx: EngineContext): string {
  if (!_walk) return ''
  if (!node.varName) {
    ctx.warnings.push('@foreach: missing iteration variable name')
    return ''
  }
  const sourceLiteral = node.literalSource ?? ''
  const sourceValue = evaluateSource(sourceLiteral, ctx)
  const items = splitItems(sourceValue)
  if (items.length === 0) return ''

  const previous = ctx.envFiles[node.varName]
  const parts: string[] = []
  for (const item of items) {
    ctx.envFiles[node.varName] = item
    // Substitute {{ varName }} into the body's directive args as well as
    // markdown text. Without this pass, a body node like
    // `@read-frontmatter path="{{ doc }}"` would carry `{{ doc }}` literally
    // into execution. With substitution, each iteration sees a fresh copy
    // of the body with the current item interpolated everywhere.
    const subbed = substituteParams(node.body, { [node.varName]: item })
    const bodyOut = _walk(subbed, ctx).join('\n')
    parts.push(bodyOut)
  }
  // Restore (or delete) the previous binding so nesting / sibling foreach work.
  if (previous === undefined) delete ctx.envFiles[node.varName]
  else ctx.envFiles[node.varName] = previous
  return parts.join('\n')
}

export function executeSet(node: SetNode, ctx: EngineContext): string {
  if (!node.varName) {
    ctx.warnings.push('@set: missing variable name')
    return ''
  }
  const literal = (node.literalExpr ?? '').trim()
  // Fast path: literal is a single `{{ expr }}` with nothing else around it.
  // Evaluate the expression with type preserved (boolean / number / object
  // stay typed) and store under ctx.data so @if/@switch downstream see the
  // real type. Without this, `@set t = {{ false }}` stored "false" as a
  // string, and `@if {{ t }}` then took the truthy branch (non-empty string).
  const singleInterp = literal.match(/^\{\{\s*([\s\S]*?)\s*\}\}$/)
  if (singleInterp) {
    const typed = evalExpressionTyped(singleInterp[1]!.trim(), ctx)
    if (typed !== undefined && typed !== null) {
      ctx.data[node.varName] = typed
      // Stringified fallback for callers that read via ctx.envFiles
      // (interpolation in text contexts, legacy code paths).
      ctx.envFiles[node.varName] = typeof typed === 'object'
        ? JSON.stringify(typed)
        : String(typed)
    } else {
      ctx.envFiles[node.varName] = ''
    }
    return ''
  }
  // Mixed text+interpolation or @directive RHS: fall back to string eval.
  let value = evaluateSource(literal, ctx)
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1)
  }
  ctx.envFiles[node.varName] = value
  return ''
}
