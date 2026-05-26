import { runInNewContext } from 'node:vm'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import type { EngineContext } from './context.js'
import { checkDataPath } from './security/filesystem.js'
import { logEngineError } from './error-log.js'

/**
 * Read <cwd>/.mdd/settings.json (or <cwd>/.markdownai/settings.json as a
 * fallback) and parse as JSON. Cached per (cwd, mtime) to avoid re-reading
 * on every expression evaluation. Failure is silent — returns undefined,
 * and `settings.X` references then resolve to ReferenceError (suppressed).
 */
const settingsCache = new Map<string, { mtimeMs: number; value: unknown }>()

function loadProjectSettings(cwd: string): unknown {
  const candidates = [
    resolve(cwd, '.mdd', 'settings.json'),
    resolve(cwd, '.markdownai', 'settings.json'),
  ]
  for (const path of candidates) {
    try {
      const stat = statSync(path)
      const cached = settingsCache.get(path)
      if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value
      const raw = readFileSync(path, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      settingsCache.set(path, { mtimeMs: stat.mtimeMs, value: parsed })
      return parsed
    } catch {
      continue
    }
  }
  return undefined
}
import { readFrontmatterField } from './frontmatter-utils.js'

function makeFileHelpers(
  dataJail: string | null,
  allowedDataPaths: string[] | undefined,
  fsConfig: import('./security/config.js').FilesystemSecurityConfig | undefined,
) {
  function confined(p: string): string | null {
    if (!dataJail) return null
    const check = checkDataPath(p, dataJail, allowedDataPaths, fsConfig)
    if (check.level === 'blocked') return null
    return isAbsolute(p) ? p : resolve(dataJail, p)
  }
  return {
    exists: (p: string): boolean => {
      const abs = confined(p)
      return abs !== null ? existsSync(abs) : false
    },
    isFile: (p: string): boolean => {
      const abs = confined(p)
      if (abs === null) return false
      try { return statSync(abs).isFile() } catch { return false }
    },
    isDir: (p: string): boolean => {
      const abs = confined(p)
      if (abs === null) return false
      try { return statSync(abs).isDirectory() } catch { return false }
    },
    containsLine: (p: string, pattern: string): boolean => {
      const abs = confined(p)
      if (abs === null || !existsSync(abs)) return false
      try {
        const content = readFileSync(abs, 'utf8')
        const re = new RegExp(pattern, 'm')
        return re.test(content)
      } catch { return false }
    },
    frontmatterField: (p: string, field: string): string => {
      const abs = confined(p)
      if (abs === null || !existsSync(abs)) return ''
      try {
        const content = readFileSync(abs, 'utf8')
        const v = readFrontmatterField(content, field)
        return v ?? ''
      } catch { return '' }
    },
    containsSection: (p: string, heading: string): boolean => {
      const abs = confined(p)
      if (abs === null || !existsSync(abs)) return false
      try {
        const content = readFileSync(abs, 'utf8')
        // Match Markdown ATX heading on its own line. Accept exact "## Bugs"
        // or "## Bugs " — trailing whitespace OK. Heading argument can include
        // the leading `#`s ("## Bugs") or just the title ("Bugs"), in which
        // case we match any heading level.
        const normalized = heading.trim()
        if (/^#+\s/.test(normalized)) {
          const re = new RegExp('^' + normalized.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*$', 'm')
          return re.test(content)
        }
        const re = new RegExp('^#{1,6}\\s+' + normalized.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*$', 'm')
        return re.test(content)
      } catch { return false }
    },
  }
}

export function allowed(
  value: unknown,
  allowedValues: unknown,
  options?: { ignoreCase?: boolean },
): unknown {
  let list: unknown[]
  if (Array.isArray(allowedValues)) {
    list = allowedValues
  } else if (typeof allowedValues === 'string') {
    list = [allowedValues]
  } else {
    return false
  }
  if (options?.ignoreCase === true && typeof value === 'string') {
    const lower = value.toLowerCase()
    return list.some(v => (typeof v === 'string' ? v.toLowerCase() === lower : v === value)) ? value : false
  }
  return list.includes(value) ? value : false
}

export function evalCondition(expr: string, ctx: EngineContext): boolean {
  // Pre-expand {{ expr }} interpolations so @if {{ label }} == "val" works.
  // Emit each inner result as a JS literal that preserves the original
  // truthiness:
  //   boolean / number   → bare literal (so `false` stays falsy, `0` stays falsy)
  //   string             → quoted JS string literal
  //   object / array     → JSON.stringify (object/array literal — always truthy)
  //   undefined / null   → empty string literal "" (falsy)
  // Without this, String(false) → "false" → quoted "\"false\"" → truthy
  // string, and @if {{ !condition }} would always take the true branch.
  const expanded = expr.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_, inner) => {
    const result = runExpr(inner.trim(), ctx)
    if (result === undefined || result === null) return JSON.stringify('')
    if (typeof result === 'boolean' || typeof result === 'number') return String(result)
    if (typeof result === 'string') return JSON.stringify(result)
    return JSON.stringify(result)
  })
  return Boolean(runExpr(expanded, ctx))
}

export function evalExpression(expr: string, ctx: EngineContext): string {
  const result = runExpr(expr, ctx)
  if (result === undefined || result === null) return ''
  // Render objects and arrays as JSON so {{ structVar }} produces useful
  // output instead of "[object Object]". Leaf values (string, number,
  // boolean) stringify via String() as before.
  if (typeof result === 'object') return JSON.stringify(result, null, 2)
  return String(result)
}

/**
 * Same as evalExpression but returns the raw typed value (boolean, number,
 * object, etc.) without stringification. Used by directives like @set that
 * need to preserve type when binding a value so subsequent @if checks see
 * the real boolean/number rather than its string form.
 */
export function evalExpressionTyped(expr: string, ctx: EngineContext): unknown {
  return runExpr(expr, ctx)
}

/**
 * Transform expression-level pipe chains into nested function calls.
 *
 *   X | filter1 | filter2(arg2)   →   filter2(filter1(X), arg2)
 *
 * Splits on top-level `|` (ignores `||`, quoted strings, and `|` inside
 * brackets/braces/parens). Each segment after the first is treated as a
 * filter — bare identifier or `fn(args)` form. The piped value is inserted
 * as the FIRST argument to the filter.
 *
 * Returns the original expression unchanged if there are no pipes or if
 * any segment is malformed (so the existing parser/evaluator handles it).
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
    // Top-level | that isn't part of || (logical OR)
    if (c === '|' && depth === 0 && expr[i + 1] !== '|' && expr[i - 1] !== '|') {
      segments.push(expr.slice(start, i))
      start = i + 1
    }
  }
  segments.push(expr.slice(start))
  if (segments.length < 2) return expr

  const trimmedSegs = segments.map(s => s.trim()).filter(s => s.length > 0)
  if (trimmedSegs.length < 2) return expr

  let acc = trimmedSegs[0]!
  for (let i = 1; i < trimmedSegs.length; i++) {
    const filter = trimmedSegs[i]!
    // Match: fn  OR  fn(args)
    const m = filter.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\(([\s\S]*)\))?\s*$/)
    if (!m) return expr // bail — return original so callers see the parse failure
    const fn = m[1]!
    const args = m[2]?.trim() ?? ''
    acc = args ? `${fn}(${acc}, ${args})` : `${fn}(${acc})`
  }
  return acc
}

function preprocessExpr(expr: string): string {
  // Pipe transform runs first so subsequent transforms see the rewritten form.
  expr = transformPipes(expr)
  // Convert file.exists "./path" → file.exists("./path") (and isFile, isDir)
  let result = expr.replace(/\bfile\.(exists|isFile|isDir)\s+"([^"]*)"/g, 'file.$1("$2")')
                   .replace(/\bfile\.(exists|isFile|isDir)\s+'([^']*)'/g, "file.$1('$2')")
  // Convert: lhs match "pattern" → new RegExp("pattern").test(lhs)
  // LHS can be a quoted string (after {{ }} expansion) or an identifier/dotted path.
  result = result
    .replace(/("[^"]*"|'[^']*'|[A-Za-z_$][A-Za-z0-9_.$]*)\s+\bmatch\b\s+"([^"]*)"/g,
      (_, lhs, pat) => `new RegExp(${JSON.stringify(pat)}).test(${lhs})`)
    .replace(/("[^"]*"|'[^']*'|[A-Za-z_$][A-Za-z0-9_.$]*)\s+\bmatch\b\s+'([^']*)'/g,
      (_, lhs, pat) => `new RegExp(${JSON.stringify(pat)}).test(${lhs})`)
  // Convert MarkdownAI equality syntax: identifier="value" → identifier === "value"
  // Lookbehind ensures we don't transform !=, <=, >=, == — only bare =
  // Use a replacer function so captured values with $ are not misinterpreted as replacement patterns.
  result = result.replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?<![!<>=])=(?!=)\s*"([^"]*)"/g,
      (_, id: string, val: string) => `${id} === "${val}"`)
                 .replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?<![!<>=])=(?!=)\s*'([^']*)'/g,
      (_, id: string, val: string) => `${id} === '${val}'`)
  // Convert Claude Code skill variable syntax to sandbox identifiers:
  //   $ARGUMENTS[N] → argsList[N]
  //   $ARGUMENTS    → ARGUMENTS
  //   $N (digit)    → argsList[N]
  result = result.replace(/\$ARGUMENTS\[(\d+)\]/g, 'argsList[$1]')
                 .replace(/\$ARGUMENTS\b/g, 'ARGUMENTS')
                 .replace(/\$(\d+)\b/g, 'argsList[$1]')
  return result
}

const SAFE_ENV_KEY = /^[A-Z_][A-Z0-9_]*$/i

const RESERVED_SANDBOX_KEYS = new Set([
  'env', 'file', 'consumer', 'ARGUMENTS', 'args', 'argsList',
  'arg0', 'arg1', 'arg2', 'arg3',
  'CLAUDE_SESSION_ID', 'CLAUDE_EFFORT', 'CLAUDE_SKILL_DIR',
  'allowed',
])

function buildSandbox(ctx: EngineContext): Record<string, unknown> {
  const envObj: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  // Only spread env vars with safe identifier names to prevent prototype collision.
  // All vars remain accessible under env.VAR_NAME regardless.
  const rootEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(envObj)) {
    if (SAFE_ENV_KEY.test(k)) rootEnv[k] = v
  }
  // v2.0: prefer dataJail; fall back to legacy jailRoot/docDir for old callers.
  const dataJail = ctx.security.dataJail ?? ctx.security.jailRoot ?? ctx.docDir ?? null
  const file = makeFileHelpers(dataJail, ctx.security.allowedDataPaths, ctx.security.filesystemConfig)
  const skill = ctx.skillContext
  const ARGUMENTS = skill?.args ?? ''
  const argsList = skill?.argsList ?? []
  const safeNamedArgs: Record<string, string> = {}
  for (const [k, v] of Object.entries(skill?.namedArgs ?? {})) {
    if (!RESERVED_SANDBOX_KEYS.has(k)) safeNamedArgs[k] = v
  }
  // Structured data store: spread safe-named keys at the top level so
  // expressions can navigate via dot syntax ({{ info.detected }},
  // {{ info.frameworks.mdd.layout.directories.features }}).
  // Keys collide with envFiles entries: data wins, since data was added
  // explicitly by a directive that returns structured output.
  const safeData: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx.data ?? {})) {
    if (SAFE_ENV_KEY.test(k) && !RESERVED_SANDBOX_KEYS.has(k)) safeData[k] = v
  }
  // Project settings: read .mdd/settings.json (or .markdownai/settings.json
  // as a fallback) from cwd and expose as `settings`. Lets flows read
  // {{ settings.telemetry.commandLogging }} etc. without each touching
  // the filesystem. Failure to read is silent — settings becomes undefined,
  // and references resolve to ReferenceError (silently caught).
  const settings = loadProjectSettings(ctx.cwd)
  return {
    ...rootEnv, ...safeData, env: envObj, file, consumer: ctx.consumer ?? '',
    settings,
    ARGUMENTS, args: ARGUMENTS, argsList,
    arg0: argsList[0] ?? '', arg1: argsList[1] ?? '', arg2: argsList[2] ?? '', arg3: argsList[3] ?? '',
    ...safeNamedArgs,
    CLAUDE_SESSION_ID: skill?.sessionId ?? '', CLAUDE_EFFORT: skill?.effort ?? '', CLAUDE_SKILL_DIR: skill?.skillDir ?? '',
    allowed,
    // Time + identity builtins. Mirrored in engine-interpolate.ts so {{ }}
    // in markdown body and @if conditions see the same surface.
    now_iso: () => new Date().toISOString(),
    now_ms: () => Date.now(),
    parse_iso_ms: (s: unknown) => {
      const t = new Date(String(s ?? '')).getTime()
      return Number.isNaN(t) ? 0 : t
    },
    uuid_v4: () => {
      // Prefer crypto.randomUUID when available (Node ≥ 14.17 / ≥ 16).
      // Falls back to a Math.random-based RFC4122-shaped value otherwise.
      const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      if (c?.randomUUID) return c.randomUUID()
      const hex = (n: number) => Math.floor(Math.random() * 16).toString(16)
      let out = ''
      for (let i = 0; i < 32; i++) {
        if (i === 8 || i === 12 || i === 16 || i === 20) out += '-'
        out += hex(i)
      }
      return out
    },
    // Pipe-style helpers callable as functions: truncate("text", 500).
    truncate: (s: unknown, n: unknown): string => {
      const text = String(s ?? '')
      const limit = Number(n)
      if (Number.isNaN(limit) || limit <= 0 || text.length <= limit) return text
      return text.slice(0, limit) + '…'
    },
    // JSON serializer.
    to_json: (v: unknown): string => {
      try { return JSON.stringify(v ?? null) } catch { return 'null' }
    },
  }
}

function runExpr(expr: string, ctx: EngineContext): unknown {
  try {
    return runInNewContext(preprocessExpr(expr), buildSandbox(ctx), { timeout: 500 })
  } catch (err) {
    const e = err as Error
    if (e?.name === 'ReferenceError') {
      logEngineError({
        source: 'runExpr',
        decision: 'suppressed',
        expression: expr.trim(),
        document: ctx.docDir,
        phase: ctx.phase ?? undefined,
        error_name: e.name,
        error_message: e.message,
      })
      return undefined
    }
    ctx.warnings.push(`Unresolvable expression: ${expr.trim()}`)
    logEngineError({
      source: 'runExpr',
      decision: 'warned',
      expression: expr.trim(),
      document: ctx.docDir,
      phase: ctx.phase ?? undefined,
      error_name: e?.name ?? 'Error',
      error_message: e?.message ?? String(err),
    })
    return undefined
  }
}
