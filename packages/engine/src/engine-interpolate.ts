import { execSync } from 'node:child_process'
import { resolve, isAbsolute } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import type { InterpolationSpan, ShellInlineSpan } from '@markdownai/parser'
import { readMarkdownSection, parseFeatureBrief, extractFilePaths } from './sources.js'
import { resolveEnv, type EngineContext } from './context.js'
import { allowed } from './conditions.js'
import { logEngineError } from './error-log.js'
import { readFileSync, statSync as fsStatSync } from 'node:fs'

// Project-settings loader (matches conditions.ts; same cache shape).
const settingsCache = new Map<string, { mtimeMs: number; value: unknown }>()
function loadProjectSettings(cwd: string): unknown {
  const candidates = [
    resolve(cwd, '.mdd', 'settings.json'),
    resolve(cwd, '.markdownai', 'settings.json'),
  ]
  for (const path of candidates) {
    try {
      const stat = fsStatSync(path)
      const cached = settingsCache.get(path)
      if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value
      const raw = readFileSync(path, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      settingsCache.set(path, { mtimeMs: stat.mtimeMs, value: parsed })
      return parsed
    } catch { continue }
  }
  return undefined
}

/**
 * Expression-level pipe transform (mirrors conditions.ts transformPipes).
 * Rewrites `X | filter | filter2(arg)` as `filter2(filter(X), arg)`.
 */
function transformPipes(expr: string): string {
  const segments: string[] = []
  let depth = 0
  let inStr: string | null = null
  let start = 0
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]!
    if (inStr !== null) {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    if (c === '(' || c === '[' || c === '{') { depth++; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; continue }
    if (c === '|' && depth === 0 && expr[i + 1] !== '|' && expr[i - 1] !== '|') {
      segments.push(expr.slice(start, i))
      start = i + 1
    }
  }
  segments.push(expr.slice(start))
  const trimmed = segments.map(s => s.trim()).filter(s => s.length > 0)
  if (trimmed.length < 2) return expr
  let acc = trimmed[0]!
  for (let i = 1; i < trimmed.length; i++) {
    const filter = trimmed[i]!
    const m = filter.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\(([\s\S]*)\))?\s*$/)
    if (!m) return expr
    const fn = m[1]!
    const args = m[2]?.trim() ?? ''
    acc = args ? `${fn}(${acc}, ${args})` : `${fn}(${acc})`
  }
  return acc
}
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
  function confinedPath(p: string): string | null {
    if (!dataJail) return null
    const check = checkDataPath(p, dataJail, allowedDataPaths, fsConfig)
    if (check.level === 'blocked') return null
    return isAbsolute(p) ? p : resolve(dataJail, p)
  }
  const fileHelper = {
    exists: (p: string): boolean => {
      const abs = confinedPath(p)
      return abs !== null && existsSync(abs)
    },
    isFile: (p: string): boolean => {
      const abs = confinedPath(p)
      if (abs === null) return false
      try { return statSync(abs).isFile() } catch { return false }
    },
    isDir: (p: string): boolean => {
      const abs = confinedPath(p)
      if (abs === null) return false
      try { return statSync(abs).isDirectory() } catch { return false }
    },
    readSection: (p: string, headingContains: string): string => {
      const abs = confinedPath(p)
      if (abs === null) return ''
      return readMarkdownSection(abs, headingContains)
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
  const settings = loadProjectSettings(ctx.cwd)
  const sandbox: Record<string, unknown> = {
    ...envObj,
    ...safeData,
    settings,
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
    // Mirrors conditions.ts buildSandbox builtins so {{ }} in markdown body
    // and @if conditions resolve the same surface.
    now_iso: () => new Date().toISOString(),
    now_ms: () => Date.now(),
    parse_iso_ms: (s: unknown) => {
      const t = new Date(String(s ?? '')).getTime()
      return Number.isNaN(t) ? 0 : t
    },
    uuid_v4: () => {
      const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      if (c?.randomUUID) return c.randomUUID()
      const hex = () => Math.floor(Math.random() * 16).toString(16)
      let out = ''
      for (let i = 0; i < 32; i++) {
        if (i === 8 || i === 12 || i === 16 || i === 20) out += '-'
        out += hex()
      }
      return out
    },
    truncate: (s: unknown, n: unknown): string => {
      const text = String(s ?? '')
      const limit = Number(n)
      if (Number.isNaN(limit) || limit <= 0 || text.length <= limit) return text
      return text.slice(0, limit) + '…'
    },
    to_json: (v: unknown): string => {
      try { return JSON.stringify(v ?? null) } catch { return 'null' }
    },
    read_section: (path: unknown, headingContains: unknown): string => {
      return fileHelper.readSection(String(path ?? ''), String(headingContains ?? ''))
    },
    parse_brief: (text: unknown): Record<string, string> => {
      return parseFeatureBrief(String(text ?? ''))
    },
    extract_paths: (text: unknown): string[] => {
      return extractFilePaths(String(text ?? ''))
    },
  }
  try {
    // Pipe-style expression transform: `X | filter | filter2(arg)` →
    // `filter2(filter(X), arg)`. Lets flows write {{ argsList | to_json }}
    // and similar without needing parser-level pipe syntax in expressions.
    const piped = transformPipes(trimmed)
    const result = runInNewContext(piped, sandbox, { timeout: 500 })
    if (result === undefined || result === null) return ''
    // Render objects/arrays as JSON so {{ structVar }} produces useful
    // output instead of "[object Object]" or "Array(2)".
    if (typeof result === 'object') return JSON.stringify(result, null, 2)
    return String(result)
  } catch (err) {
    const e = err as Error
    // Match conditions.ts runExpr behavior: ReferenceError (undefined
    // variable) is silent in the warnings array — multi-phase document
    // renders walk every phase, and phases that don't apply legitimately
    // reference variables that other phases would have set. Emitting a
    // warning per reference floods the output with noise that's already
    // implied by the missing content.
    //
    // Every error (suppressed or warned) is logged to
    // ~/.markdownai/logs/markdownai-error.log for audit/debugging.
    if (e?.name === 'ReferenceError') {
      logEngineError({
        source: 'evalExpr',
        decision: 'suppressed',
        expression: trimmed,
        document: ctx.docDir,
        phase: ctx.phase ?? undefined,
        error_name: e.name,
        error_message: e.message,
      })
      return ''
    }
    ctx.warnings.push(`Unresolvable expression: ${trimmed}`)
    logEngineError({
      source: 'evalExpr',
      decision: 'warned',
      expression: trimmed,
      document: ctx.docDir,
      phase: ctx.phase ?? undefined,
      error_name: e?.name ?? 'Error',
      error_message: e?.message ?? String(err),
    })
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
