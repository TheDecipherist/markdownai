// v2.0 write directive executors: @mkdir, @copy, @append-if-missing.
//
// All three share the same security gate (filesystem.write_enabled + writeJail
// + allowed_write_paths) and run through checkWritePath() for each destination
// path. Source paths in @copy go through the data-jail check (read access).

import { mkdirSync, copyFileSync, existsSync, readFileSync, appendFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve, isAbsolute, dirname } from 'node:path'
import type { MkdirNode, CopyNode, AppendIfMissingNode, UpdateFrontmatterNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { checkDataPath, checkWritePath } from './security/filesystem.js'
import { expandPattern } from './security/path-expand.js'

function buildExpandContext(ctx: EngineContext) {
  const env: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const expandCtx: import('./security/path-expand.js').PatternExpandContext = { env }
  const skillDir = ctx.skillContext?.skillDir
  const sessionId = ctx.skillContext?.sessionId
  if (skillDir) expandCtx.skillDir = skillDir
  if (sessionId) expandCtx.sessionId = sessionId
  return expandCtx
}

function ensureWriteEnabled(ctx: EngineContext, directive: string): boolean {
  if (!ctx.security.writeEnabled) {
    ctx.warnings.push(`${directive}: filesystem write is disabled — enable with filesystem.write_enabled in security.json`)
    return false
  }
  if (!ctx.security.writeJail) {
    ctx.warnings.push(`${directive}: no write jail resolved — check security.json filesystem.write_root`)
    return false
  }
  return true
}

function resolveWritePath(rawPath: string, ctx: EngineContext, directive: string): string | null {
  // ${VAR} expansion at use time so users can reference CLAUDE_SKILL_DIR etc.
  const expanded = expandPattern(rawPath, buildExpandContext(ctx))
  const writeJail = ctx.security.writeJail!
  const abs = isAbsolute(expanded) ? expanded : resolve(writeJail, expanded)
  const check = checkWritePath(abs, writeJail, ctx.security.allowedWritePaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} write blocked — ${check.reason}: ${rawPath}`)
    return null
  }
  if (check.level === 'alert') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} sensitive write — ${check.reason}: ${rawPath}`)
  }
  return abs
}

function resolveReadPath(rawPath: string, ctx: EngineContext, directive: string): string | null {
  // Read source for @copy goes through the data-jail check; same allowlist rules.
  const expanded = expandPattern(rawPath, buildExpandContext(ctx))
  const dataJail = ctx.security.dataJail ?? ctx.security.jailRoot ?? ctx.docDir ?? null
  if (!dataJail) {
    ctx.warnings.push(`${directive}: no data jail for source path: ${rawPath}`)
    return null
  }
  const abs = isAbsolute(expanded) ? expanded : resolve(dataJail, expanded)
  const check = checkDataPath(abs, dataJail, ctx.security.allowedDataPaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} source blocked — ${check.reason}: ${rawPath}`)
    return null
  }
  if (check.level === 'alert') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} sensitive source — ${check.reason}: ${rawPath}`)
  }
  return abs
}

export function executeMkdir(node: MkdirNode, ctx: EngineContext): string {
  if (!ensureWriteEnabled(ctx, '@mkdir')) return ''
  const target = resolveWritePath(node.path, ctx, '@mkdir')
  if (!target) return ''
  const recursive = node.args['recursive'] !== 'false'
  try {
    mkdirSync(target, { recursive })
  } catch (err) {
    ctx.warnings.push(`@mkdir failed: ${node.path} — ${String(err)}`)
  }
  return ''
}

export function executeCopy(node: CopyNode, ctx: EngineContext): string {
  if (!ensureWriteEnabled(ctx, '@copy')) return ''
  if (!node.from || !node.to) {
    ctx.warnings.push('@copy: both from= and to= are required')
    return ''
  }
  const dst = resolveWritePath(node.to, ctx, '@copy')
  if (!dst) return ''
  // if-missing: skip if destination already exists. Common bootstrap pattern.
  const ifMissing = 'if-missing' in node.args || node.args['if-missing'] === 'true'
  if (ifMissing && existsSync(dst)) return ''
  const src = resolveReadPath(node.from, ctx, '@copy')
  if (!src) return ''
  if (!existsSync(src)) {
    ctx.warnings.push(`@copy: source does not exist: ${node.from}`)
    return ''
  }
  try {
    // Ensure destination directory exists (saves callers a @mkdir).
    const parent = dirname(dst)
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
    copyFileSync(src, dst)
  } catch (err) {
    ctx.warnings.push(`@copy failed: ${node.from} -> ${node.to} — ${String(err)}`)
  }
  return ''
}

export function executeAppendIfMissing(node: AppendIfMissingNode, ctx: EngineContext): string {
  if (!ensureWriteEnabled(ctx, '@append-if-missing')) return ''
  if (!node.path) {
    ctx.warnings.push('@append-if-missing: path= is required')
    return ''
  }
  if (node.text === '') return ''  // nothing to append; treat as no-op
  const target = resolveWritePath(node.path, ctx, '@append-if-missing')
  if (!target) return ''
  // If target doesn't exist, this directive intentionally does NOT create it.
  // Use @copy or a separate @mkdir + @copy if you want to seed a new file.
  if (!existsSync(target)) {
    ctx.warnings.push(`@append-if-missing: target file does not exist: ${node.path} (no-op)`)
    return ''
  }
  try {
    const existing = readFileSync(target, 'utf8')
    if (existing.includes(node.text)) return ''
    const needsNewline = existing.length > 0 && !existing.endsWith('\n')
    appendFileSync(target, (needsNewline ? '\n' : '') + node.text + (node.text.endsWith('\n') ? '' : '\n'))
  } catch (err) {
    ctx.warnings.push(`@append-if-missing failed: ${node.path} — ${String(err)}`)
  }
  return ''
}

/**
 * @update-frontmatter — replace a single YAML frontmatter field value in-place.
 *
 * Frontmatter is the leading `---` ... `---` block. Only top-level scalar
 * fields are supported (`status: complete`, `last_synced: 2026-05-23`).
 * Nested objects, lists, and multi-line scalars are out of scope for v2.0 —
 * use @copy + manual edit for those cases.
 *
 * Idempotent: if the existing value already matches `value`, no write happens.
 * If the field is missing from the frontmatter block, it is appended (above
 * the closing `---`). If the file has no frontmatter block, the operation
 * fails with a warning rather than corrupting the file.
 */
export function executeUpdateFrontmatter(node: UpdateFrontmatterNode, ctx: EngineContext): string {
  if (!ensureWriteEnabled(ctx, '@update-frontmatter')) return ''
  if (!node.path || !node.field) {
    ctx.warnings.push('@update-frontmatter: path= and field= are required')
    return ''
  }
  const target = resolveWritePath(node.path, ctx, '@update-frontmatter')
  if (!target) return ''
  if (!existsSync(target)) {
    ctx.warnings.push(`@update-frontmatter: target does not exist: ${node.path}`)
    return ''
  }
  let content: string
  try { content = readFileSync(target, 'utf8') } catch (err) {
    ctx.warnings.push(`@update-frontmatter failed: cannot read ${node.path}: ${String(err)}`)
    return ''
  }

  // YAML frontmatter detection: file MUST start with `---\n` and have a closing `---\n`.
  // Anything else is rejected to avoid corrupting non-frontmatter files.
  const fmRegex = /^---\n([\s\S]*?)\n---\n?/
  const fmMatch = content.match(fmRegex)
  if (!fmMatch) {
    ctx.warnings.push(`@update-frontmatter: ${node.path} has no YAML frontmatter block (must start with --- ... ---)`)
    return ''
  }
  const fmBody = fmMatch[1] ?? ''
  const fmFull = fmMatch[0]

  // Escape regex metacharacters in the field name (kebab-case allowed) and build
  // a regex that matches `<field>: <existing-value>` at top level (no leading
  // whitespace — nested fields skipped).
  const fieldRe = new RegExp(`^(${node.field.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}):[ \\t]*(.*)$`, 'm')

  let newFmBody: string
  if (fieldRe.test(fmBody)) {
    // Replace existing field's value
    const existingMatch = fmBody.match(fieldRe)
    const existingValue = (existingMatch?.[2] ?? '').trim()
    if (existingValue === node.value) {
      return '' // idempotent no-op
    }
    newFmBody = fmBody.replace(fieldRe, `$1: ${node.value}`)
  } else {
    // Field absent — append before the closing ---
    newFmBody = fmBody + `\n${node.field}: ${node.value}`
  }

  const newContent = content.replace(fmFull, `---\n${newFmBody}\n---\n`)
  try {
    writeFileSync(target, newContent, 'utf8')
  } catch (err) {
    ctx.warnings.push(`@update-frontmatter failed: cannot write ${node.path}: ${String(err)}`)
  }
  return ''
}

// Suppress unused-var warning for statSync until a future use.
void statSync
