import { execSync } from 'node:child_process'
import { resolve, isAbsolute } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import type { InterpolationSpan, ShellInlineSpan } from '@markdownai/parser'
import { resolveEnv, type EngineContext } from './context.js'
import { allowed } from './conditions.js'
import { checkShellCommand } from './security/shell.js'
import { checkDataPath } from './security/filesystem.js'
import type { ShellSecurityConfig } from './security/config.js'
import { formatDate } from './sources.js'

export function executeShellInline(command: string, ctx: EngineContext): string {
  if (!ctx.security.allowShell) {
    ctx.warnings.push(`Shell inline blocked (allowShell is false): \`${command}\``)
    return ''
  }
  const shellConfig: ShellSecurityConfig = ctx.security.shellConfig ?? {
    enabled: true,
    allow_patterns: [],
    deny_patterns: [],
    allow_network: false,
    require_confirmation: false,
    audit_log: false,
  }
  const check = checkShellCommand(command, shellConfig)
  if (!check.allowed) {
    ctx.warnings.push(`Shell inline blocked [${check.tier}]: ${check.reason}`)
    return ''
  }
  try {
    const out = execSync(command, { cwd: ctx.cwd, encoding: 'utf8', timeout: 10_000 })
    return out.trimEnd()
  } catch (err) {
    ctx.warnings.push(`Shell inline failed: \`${command}\` — ${String(err)}`)
    return ''
  }
}

// Skill context variables that take precedence over plain env var lookups.
// Matches the sandbox keys set up in conditions.ts so {{ ARGUMENTS }} behaves
// identically to ARGUMENTS inside @if conditions.
function skillVarValue(name: string, ctx: EngineContext): string | undefined {
  const skill = ctx.skillContext
  if (!skill) return undefined
  switch (name) {
    case 'ARGUMENTS': return skill.args
    case 'CLAUDE_SESSION_ID': return skill.sessionId
    case 'CLAUDE_EFFORT': return skill.effort
    case 'CLAUDE_SKILL_DIR': return skill.skillDir
    default: return undefined
  }
}

export function evalExpr(expr: string, ctx: EngineContext): string {
  const trimmed = expr.trim()

  if (/^[A-Z_][A-Z0-9_]*$/.test(trimmed)) {
    const skillVal = skillVarValue(trimmed, ctx)
    if (skillVal !== undefined) return skillVal
    return resolveEnv(trimmed, null, ctx)
  }

  const dateFmtMatch = trimmed.match(/^date\s+format="([^"]*)"$/)
  if (dateFmtMatch) return formatDate(new Date(), dateFmtMatch[1] ?? 'ISO')

  const envObj: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  // v2.0: data ops jail to dataJail (default: process cwd). Fall back to legacy
  // jailRoot/docDir if dataJail not configured by caller.
  const dataJail = ctx.security.dataJail ?? ctx.security.jailRoot ?? ctx.docDir ?? null
  const allowedDataPaths = ctx.security.allowedDataPaths
  const fsConfig = ctx.security.filesystemConfig
  const fileHelper = {
    exists: (p: string): boolean => {
      if (!dataJail) return false
      const check = checkDataPath(p, dataJail, allowedDataPaths, fsConfig)
      if (check.level === 'blocked') return false
      return existsSync(isAbsolute(p) ? p : resolve(dataJail, p))
    },
    isFile: (p: string): boolean => {
      if (!dataJail) return false
      const check = checkDataPath(p, dataJail, allowedDataPaths, fsConfig)
      if (check.level === 'blocked') return false
      try { return statSync(isAbsolute(p) ? p : resolve(dataJail, p)).isFile() } catch { return false }
    },
    isDir: (p: string): boolean => {
      if (!dataJail) return false
      const check = checkDataPath(p, dataJail, allowedDataPaths, fsConfig)
      if (check.level === 'blocked') return false
      try { return statSync(isAbsolute(p) ? p : resolve(dataJail, p)).isDirectory() } catch { return false }
    },
  }
  // Build the sandbox with skill context variables exposed at the top level
  // (mirrors conditions.ts so {{ arg0 }} / {{ argsList[0] }} / etc. resolve correctly).
  const skill = ctx.skillContext
  const argsList = skill?.argsList ?? []
  // Structured data store: spread safe-named keys at the top level so
  // interpolations can navigate via dot syntax ({{ info.detected }},
  // {{ info.frameworks.mdd.layout.directories.features }}). Spread AFTER
  // envObj so struct entries shadow same-name string entries from envFiles.
  const safeData: Record<string, unknown> = {}
  const RESERVED = new Set(['env', 'file', 'ARGUMENTS', 'args', 'argsList', 'arg0', 'arg1', 'arg2', 'arg3', 'CLAUDE_SESSION_ID', 'CLAUDE_EFFORT', 'CLAUDE_SKILL_DIR', 'allowed'])
  for (const [k, v] of Object.entries(ctx.data ?? {})) {
    if (/^[A-Z_][A-Z0-9_]*$/i.test(k) && !RESERVED.has(k)) safeData[k] = v
  }
  const sandbox: Record<string, unknown> = {
    ...envObj,
    ...safeData,
    env: envObj,
    file: fileHelper,
    ARGUMENTS: skill?.args ?? '',
    args: skill?.args ?? '',
    argsList,
    arg0: argsList[0] ?? '',
    arg1: argsList[1] ?? '',
    arg2: argsList[2] ?? '',
    arg3: argsList[3] ?? '',
    CLAUDE_SESSION_ID: skill?.sessionId ?? '',
    CLAUDE_EFFORT: skill?.effort ?? '',
    CLAUDE_SKILL_DIR: skill?.skillDir ?? '',
    allowed,
  }
  try {
    const result = runInNewContext(trimmed, sandbox, { timeout: 500 })
    if (result === undefined || result === null) return ''
    // Render objects/arrays as JSON so {{ structVar }} produces useful
    // output instead of "[object Object]" or "Array(2)".
    if (typeof result === 'object') return JSON.stringify(result, null, 2)
    return String(result)
  } catch {
    ctx.warnings.push(`Unresolvable expression: ${trimmed}`)
    return ''
  }
}

export function resolveInterpolations(
  text: string,
  spans: InterpolationSpan[],
  ctx: EngineContext,
  shellInlines: ShellInlineSpan[] = [],
): string {
  if (spans.length === 0 && shellInlines.length === 0) return text

  type AnySpan = { start: number; end: number; resolve: () => string }
  const all: AnySpan[] = [
    ...spans.map(s => ({ start: s.start, end: s.end, resolve: () => s.escaped ? `{{${s.expression}}}` : evalExpr(s.expression, ctx) })),
    ...shellInlines.map(s => ({ start: s.start, end: s.end, resolve: () => executeShellInline(s.command, ctx) })),
  ].sort((a, b) => a.start - b.start)

  let result = ''
  let pos = 0
  for (const span of all) {
    result += text.slice(pos, span.start)
    result += span.resolve()
    pos = span.end
  }
  return result + text.slice(pos)
}
