import { runInNewContext } from 'node:vm'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import type { EngineContext } from './context.js'
import { checkDataPath } from './security/filesystem.js'
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
  // Always produce a valid JS string literal — unset vars become "".
  const expanded = expr.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_, inner) => {
    const result = runExpr(inner.trim(), ctx)
    return JSON.stringify(result === undefined || result === null ? '' : String(result))
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

function preprocessExpr(expr: string): string {
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
  return {
    ...rootEnv, ...safeData, env: envObj, file, consumer: ctx.consumer ?? '',
    ARGUMENTS, args: ARGUMENTS, argsList,
    arg0: argsList[0] ?? '', arg1: argsList[1] ?? '', arg2: argsList[2] ?? '', arg3: argsList[3] ?? '',
    ...safeNamedArgs,
    CLAUDE_SESSION_ID: skill?.sessionId ?? '', CLAUDE_EFFORT: skill?.effort ?? '', CLAUDE_SKILL_DIR: skill?.skillDir ?? '',
    allowed,
  }
}

function runExpr(expr: string, ctx: EngineContext): unknown {
  try {
    return runInNewContext(preprocessExpr(expr), buildSandbox(ctx), { timeout: 500 })
  } catch (err) {
    if ((err as Error)?.name === 'ReferenceError') return undefined
    ctx.warnings.push(`Unresolvable expression: ${expr.trim()}`)
    return undefined
  }
}
