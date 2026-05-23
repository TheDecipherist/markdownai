import { readFileSync } from 'node:fs'
import { resolve, dirname, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ASTNode, IncludeNode, ImportNode } from '@markdownai/parser'
import { parse } from '@markdownai/parser'
import { type EngineContext, type Connection } from './context.js'
import { evalCondition } from './conditions.js'
import { checkSourcePath } from './security/filesystem.js'

export class FatalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FatalError'
  }
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
  // Resolve the candidate path first (relative to the importing doc's dir),
  // then security-check the absolute result against the source jail.
  const full = isAbsolute(node.path) ? node.path : resolve(ctx.docDir, node.path)
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

  const full = isAbsolute(node.path) ? node.path : resolve(ctx.docDir, node.path)
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
    ctx.warnings.push(`@include: cannot read file "${node.path}": ${String(err)}`)
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
