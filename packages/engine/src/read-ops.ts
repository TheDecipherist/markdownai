// Read-side directive executors that complement write-ops.ts:
//   @read-frontmatter  — read a single top-level YAML frontmatter field
//   @hash              — compute a hash of a file's content
//
// Both are read-only and jail against the data root (allowed_data_paths).

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import type { ReadFrontmatterNode, HashNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { checkDataPath } from './security/filesystem.js'
import { expandPattern } from './security/path-expand.js'
import { interpolatePathSoft } from './engine-include.js'
import { readFrontmatterField } from './frontmatter-utils.js'
import { resolveDataJail } from './file-access.js'

function buildExpandContext(ctx: EngineContext) {
  const env: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const expandCtx: import('./security/path-expand.js').PatternExpandContext = { env }
  const skillDir = ctx.skillContext?.skillDir
  const sessionId = ctx.skillContext?.sessionId
  if (skillDir) expandCtx.skillDir = skillDir
  if (sessionId) expandCtx.sessionId = sessionId
  return expandCtx
}

function resolveReadPath(rawPath: string, ctx: EngineContext, directive: string): string | null {
  // {{ expr }} interpolation + ${VAR} expansion, same order as @render-template's
  // `to=` path. Without the {{ }} step a top-level read like
  // `@read-frontmatter path="${CWD}/.mdd/docs/{{ id }}.md"` keeps the literal
  // {{ id }} (it only resolved inside @foreach, where the body is re-rendered).
  const expanded = interpolatePathSoft(expandPattern(rawPath, buildExpandContext(ctx)), ctx)
  const dataJail = resolveDataJail(ctx)
  if (!dataJail) {
    ctx.warnings.push(`${directive}: no data jail for path: ${rawPath}`)
    return null
  }
  const abs = isAbsolute(expanded) ? expanded : resolve(dataJail, expanded)
  const check = checkDataPath(abs, dataJail, ctx.security.allowedDataPaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} blocked — ${check.reason}: ${rawPath}`)
    return null
  }
  if (check.level === 'alert') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} sensitive path accessed — ${check.reason}: ${rawPath}`)
  }
  return abs
}

export function executeReadFrontmatter(node: ReadFrontmatterNode, ctx: EngineContext): string {
  if (!node.path || !node.field) {
    ctx.warnings.push('@read-frontmatter: path= and field= are required')
    return ''
  }
  const target = resolveReadPath(node.path, ctx, '@read-frontmatter')
  if (!target) return ''
  if (!existsSync(target)) {
    ctx.warnings.push(`@read-frontmatter: file does not exist: ${node.path}`)
    return ''
  }
  let content: string
  try { content = readFileSync(target, 'utf8') } catch (err) {
    ctx.warnings.push(`@read-frontmatter: cannot read ${node.path}: ${String(err)}`)
    return ''
  }
  const value = readFrontmatterField(content, node.field)
  if (value === null) {
    ctx.warnings.push(`@read-frontmatter: ${node.path} has no YAML frontmatter block`)
    return ''
  }
  const label = node.args['label']
  if (label) ctx.envFiles[label] = value
  return value
}

export function executeHash(node: HashNode, ctx: EngineContext): string {
  if (!node.path) {
    ctx.warnings.push('@hash: path= is required')
    return ''
  }
  const target = resolveReadPath(node.path, ctx, '@hash')
  if (!target) return ''
  if (!existsSync(target)) {
    ctx.warnings.push(`@hash: file does not exist: ${node.path}`)
    return ''
  }
  const algo = (node.args['algo'] ?? 'sha256').toLowerCase()
  const lengthStr = node.args['length']
  const length = lengthStr ? parseInt(lengthStr, 10) : NaN
  const excludeLine = node.args['exclude-line']
  let content: string
  try { content = readFileSync(target, 'utf8') } catch (err) {
    ctx.warnings.push(`@hash: cannot read ${node.path}: ${String(err)}`)
    return ''
  }
  if (excludeLine) {
    try {
      const re = new RegExp(excludeLine)
      content = content
        .split('\n')
        .filter(line => !re.test(line))
        .join('\n')
    } catch (err) {
      ctx.warnings.push(`@hash: invalid exclude-line regex: ${String(err)}`)
      return ''
    }
  }
  let digest: string
  try {
    digest = createHash(algo).update(content).digest('hex')
  } catch (err) {
    ctx.warnings.push(`@hash: unsupported algo "${algo}": ${String(err)}`)
    return ''
  }
  const result = !isNaN(length) && length > 0 ? digest.slice(0, length) : digest
  const label = node.args['label']
  if (label) ctx.envFiles[label] = result
  return result
}
