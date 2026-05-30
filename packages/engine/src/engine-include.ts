import { readFileSync } from 'node:fs'
import { resolve, dirname, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ASTNode, IncludeNode, ImportNode } from '@markdownai/parser'
import { parse } from '@markdownai/parser'
import { type EngineContext, type Connection } from './context.js'
import { evalCondition, evalExpression } from './conditions.js'
import { checkSourcePath } from './security/filesystem.js'
import { expandPattern } from './security/path-expand.js'
import { buildExpandContext } from './expand-context.js'

/**
 * Expand ${VAR} placeholders in @import / @include source paths.
 *
 * Without this, `@include ${CLAUDE_SKILL_DIR}/templates/foo.md` is treated
 * as a literal path containing the unexpanded variable and fails. The
 * write directives (@copy, @mkdir, @append-if-missing) already expand the
 * same set; this brings the source directives to parity.
 */
function expandImportPath(rawPath: string, ctx: EngineContext): string {
  return expandPattern(rawPath, buildExpandContext(ctx))
}

export class FatalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FatalError'
  }
}

const INTERP_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g

function interpolatePathExpressions(path: string, ctx: EngineContext): string {
  return path.replace(INTERP_RE, (_, expr: string) => {
    const value = evalExpression(expr.trim(), ctx)
    if (value === '' || value === 'null') {
      throw new FatalError(
        `@include: {{ ${expr.trim()} }} evaluated to empty in path "${path}" — cannot resolve file`,
      )
    }
    return value
  })
}

/**
 * Non-fatal variant of interpolatePathExpressions. Used by data/write ops
 * (@update-frontmatter, @hash, @read, @list, @copy, @mkdir, etc.) which
 * should warn-and-continue on an empty interpolation rather than throwing
 * — multi-phase document renders walk every phase, and phases that don't
 * apply to the current invocation legitimately produce empty path
 * interpolations. Letting them throw aborts the whole render.
 */
export function interpolatePathSoft(path: string, ctx: EngineContext): string {
  return path.replace(INTERP_RE, (_, expr: string) => {
    const value = evalExpression(expr.trim(), ctx)
    return value === 'null' ? '' : value
  })
}

export function versionIsNewer(required: string, installed: string): boolean {
  const [rMaj = 0, rMin = 0] = required.split('.').map(Number)
  const [iMaj = 0, iMin = 0] = installed.split('.').map(Number)
  if (rMaj !== iMaj) return rMaj > iMaj
  return rMin > iMin
}

export function loadStdlib(ctx: EngineContext): void {
  try {
    const stdlibPath = join(dirname(fileURLToPath(import.meta.url)), 'stdlib.md')
    const source = readFileSync(stdlibPath, 'utf8')
    const ast = parse(source, { filePath: stdlibPath, inImport: true })
    for (const n of ast.nodes) {
      if (n.type === 'define') ctx.macros[n.name] = { body: n.body, params: n.params }
    }
  } catch (err) {
    ctx.warnings.push(`stdlib load failed — macro definitions from stdlib will not be available: ${String(err)}`)
  }
}

export function executeImport(node: ImportNode, ctx: EngineContext): void {
  // Expand ${VAR} patterns (CLAUDE_SKILL_DIR, HOME, env vars) before
  // resolving. Otherwise paths like ${CLAUDE_SKILL_DIR}/templates/foo.md
  // would be treated as literal directories.
  const expanded = expandImportPath(node.path, ctx)
  const full = isAbsolute(expanded) ? expanded : resolve(ctx.docDir, expanded)
  const sourceJail = ctx.security.sourceJail ?? ctx.security.jailRoot ?? ctx.docDir
  const check = checkSourcePath(full, sourceJail, ctx.security.allowedSourcePaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`@import: ${check.reason} (${node.path}) — skipped`)
    return
  }
  if (check.level === 'alert') ctx.warnings.push(`@import SECURITY_ALERT: ${check.reason} (${node.path})`)

  if (ctx.completedSet.has(full)) return
  if (ctx.resolutionStack.has(full)) {
    const chain = [...ctx.resolutionStack, full].join(' → ')
    throw new FatalError(`Circular reference detected: ${chain}`)
  }
  let source: string
  try { source = readFileSync(full, 'utf8') } catch (err) {
    ctx.warnings.push(`@import: cannot read file "${node.path}": ${String(err)}`)
    return
  }
  const ast = parse(source, { filePath: full, inImport: true })
  if (!ast.isMarkdownAI) return
  ctx.resolutionStack.add(full)
  const importCtx = { ...ctx, docDir: dirname(full) }
  for (const n of ast.nodes) {
    if (n.type === 'env' && n.fallback !== null) ctx.envFallbacks[n.name] = n.fallback
    else if (n.type === 'define') ctx.macros[n.name] = { body: n.body, params: n.params }
    else if (n.type === 'connect') ctx.connections[n.name] = { type: n.connectionType, args: n.args }
    else if (n.type === 'import') executeImport(n, importCtx)
  }
  ctx.resolutionStack.delete(full)
  ctx.completedSet.add(full)
}

export function executeInclude(
  node: IncludeNode,
  ctx: EngineContext,
  walkNodesFn: (nodes: ASTNode[], ctx: EngineContext) => string[],
): string {
  if (node.condition !== null && !evalCondition(node.condition, ctx)) return ''

  const expanded = interpolatePathExpressions(expandImportPath(node.path, ctx), ctx)
  const full = isAbsolute(expanded) ? expanded : resolve(ctx.docDir, expanded)
  const sourceJail = ctx.security.sourceJail ?? ctx.security.jailRoot ?? ctx.docDir
  const check = checkSourcePath(full, sourceJail, ctx.security.allowedSourcePaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') throw new FatalError(`@include blocked: ${check.reason}`)
  if (check.level === 'alert') ctx.warnings.push(`@include SECURITY_ALERT: ${check.reason} (${node.path})`)

  if (ctx.resolutionStack.has(full)) {
    const chain = [...ctx.resolutionStack, full].join(' → ')
    throw new FatalError(`Circular reference detected: ${chain}`)
  }
  let source: string
  try { source = readFileSync(full, 'utf8') } catch (err) {
    const displayPath = expanded !== node.path ? `"${expanded}" (from "${node.path}")` : `"${node.path}"`
    ctx.warnings.push(`@include: cannot read file ${displayPath}: ${String(err)}`)
    return ''
  }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return ''
  ctx.resolutionStack.add(full)
  const includeConns: Record<string, Connection> = { ...ctx.connections }
  const includeLocalNames = new Set<string>()
  const includeCtx = { ...ctx, docDir: dirname(full), phase: null, connections: includeConns, localConnectionNames: includeLocalNames }
  try {
    const out = walkNodesFn(ast.nodes, includeCtx).join('\n')
    ctx.resolutionStack.delete(full)
    ctx.completedSet.add(full)
    for (const [name, conn] of Object.entries(includeConns)) {
      if (!includeLocalNames.has(name)) ctx.connections[name] = conn
    }
    return out
  } catch (err) {
    ctx.resolutionStack.delete(full)
    throw err
  }
}
