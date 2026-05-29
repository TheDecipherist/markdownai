import { readFileSync } from 'node:fs'
import { resolve, dirname, isAbsolute } from 'node:path'
import type { ASTNode, TemplateNode, DataNode } from '@markdownai/parser'
import { parse } from '@markdownai/parser'
import type { EngineContext, Connection } from './context.js'
import { evalCondition, evalExpressionTyped } from './conditions.js'
import { checkSourcePath } from './security/filesystem.js'
import { evaluateSource } from './iter-ops.js'
import { FatalError } from './engine-include.js'

function evaluateRhsTyped(rhs: string, ctx: EngineContext): unknown {
  const trimmed = rhs.trim()
  if (trimmed === '') return ''
  if (trimmed.startsWith('@')) {
    return evaluateSource(trimmed, ctx)
  }
  const interpMatch = trimmed.match(/^\{\{\s*([\s\S]*?)\s*\}\}$/)
  if (interpMatch) {
    return evalExpressionTyped(interpMatch[1]!.trim(), ctx)
  }
  return evalExpressionTyped(trimmed, ctx)
}

function setNestedKey(target: Record<string, unknown>, key: string[], value: unknown): void {
  let cursor: Record<string, unknown> = target
  for (let i = 0; i < key.length - 1; i++) {
    const seg = key[i]!
    const next = cursor[seg]
    if (next === undefined || next === null || typeof next !== 'object' || Array.isArray(next)) {
      const fresh: Record<string, unknown> = {}
      cursor[seg] = fresh
      cursor = fresh
    } else {
      cursor = next as Record<string, unknown>
    }
  }
  cursor[key[key.length - 1]!] = value
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value)) as T
}

function deepMergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(source)) {
    const existing = target[k]
    if (
      existing !== null && existing !== undefined && typeof existing === 'object' && !Array.isArray(existing)
      && v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)
    ) {
      deepMergeInto(existing as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      target[k] = v
    }
  }
}

export function executeData(node: DataNode, ctx: EngineContext): string {
  const result: Record<string, unknown> = {}

  for (const entry of node.entries) {
    if (entry.kind === 'spread') {
      let value: unknown
      try {
        value = evaluateRhsTyped(entry.rhs, ctx)
      } catch (err) {
        ctx.warnings.push(`@data ${node.name}: spread "${entry.rhs}" failed to evaluate (line ${entry.line}): ${String(err)}`)
        continue
      }
      if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
        ctx.warnings.push(`@data ${node.name}: spread "${entry.rhs}" did not resolve to an object (line ${entry.line}) — skipped`)
        continue
      }
      const cloned = deepClone(value as Record<string, unknown>)
      deepMergeInto(result, cloned)
      continue
    }

    let value: unknown
    try {
      value = evaluateRhsTyped(entry.rhs, ctx)
    } catch (err) {
      ctx.warnings.push(`@data ${node.name}: ${entry.key.join('.')} = ${entry.rhs} failed to evaluate (line ${entry.line}): ${String(err)}`)
      value = ''
    }
    setNestedKey(result, entry.key, value)
  }

  ctx.data[node.name] = result
  ctx.envFiles[node.name] = JSON.stringify(result)
  return ''
}

export function executeTemplate(
  node: TemplateNode,
  ctx: EngineContext,
  walkNodesFn: (nodes: ASTNode[], ctx: EngineContext) => string[],
): string {
  if (node.condition !== null && !evalCondition(node.condition, ctx)) return ''

  const full = isAbsolute(node.path) ? node.path : resolve(ctx.docDir, node.path)
  const sourceJail = ctx.security.sourceJail ?? ctx.security.jailRoot ?? ctx.docDir
  const check = checkSourcePath(full, sourceJail, ctx.security.allowedSourcePaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') throw new FatalError(`@template blocked: ${check.reason}`)
  if (check.level === 'alert') ctx.warnings.push(`@template SECURITY_ALERT: ${check.reason} (${node.path})`)

  if (ctx.resolutionStack.has(full)) {
    const chain = [...ctx.resolutionStack, full].join(' → ')
    throw new FatalError(`Circular reference detected: ${chain}`)
  }

  let source: string
  try { source = readFileSync(full, 'utf8') } catch (err) {
    ctx.warnings.push(`@template: cannot read file "${node.path}": ${String(err)}`)
    return ''
  }

  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) {
    ctx.warnings.push(`@template: ${node.path} has no @markdownai header — rendered as empty`)
    return ''
  }

  let boundValue: unknown = undefined
  if (node.dataExpr !== null && node.dataExpr.trim() !== '') {
    try {
      boundValue = evaluateRhsTyped(node.dataExpr, ctx)
    } catch (err) {
      ctx.warnings.push(`@template ${node.path}: data="${node.dataExpr}" failed to evaluate: ${String(err)}`)
      boundValue = undefined
    }
  }

  const templateConns: Record<string, Connection> = { ...ctx.connections }
  const templateLocalNames = new Set<string>()
  const templateEnvFiles: Record<string, string> = { ...ctx.envFiles }
  const templateData: Record<string, unknown> = { ...ctx.data }
  const templateMacros = { ...ctx.macros }

  if (boundValue === undefined) {
    delete templateData[node.asName]
    delete templateEnvFiles[node.asName]
  } else {
    templateData[node.asName] = boundValue
    templateEnvFiles[node.asName] = typeof boundValue === 'object'
      ? JSON.stringify(boundValue)
      : String(boundValue)
  }

  const templateCtx: EngineContext = {
    ...ctx,
    docDir: dirname(full),
    phase: null,
    connections: templateConns,
    localConnectionNames: templateLocalNames,
    envFiles: templateEnvFiles,
    data: templateData,
    macros: templateMacros,
  }

  ctx.resolutionStack.add(full)
  try {
    const out = walkNodesFn(ast.nodes, templateCtx).join('\n')
    ctx.resolutionStack.delete(full)
    ctx.completedSet.add(full)
    return out
  } catch (err) {
    ctx.resolutionStack.delete(full)
    throw err
  }
}
