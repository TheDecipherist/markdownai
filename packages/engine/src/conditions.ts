import { runInNewContext } from 'node:vm'
import { existsSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import type { EngineContext } from './context.js'

function makeFileHelpers(jailRoot: string | null) {
  function confined(p: string): string | null {
    if (!jailRoot) return p
    const abs = resolve(jailRoot, p)
    const rel = relative(jailRoot, abs)
    if (rel.startsWith('..')) return null
    return abs
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
  }
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
  return result === undefined ? '' : String(result)
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
  result = result.replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?<![!<>=])=(?!=)\s*"([^"]*)"/g, '$1 === "$2"')
                 .replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s*(?<![!<>=])=(?!=)\s*'([^']*)'/g, "$1 === '$2'")
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

function runExpr(expr: string, ctx: EngineContext): unknown {
  const envObj: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  // Only spread env vars with safe identifier names into root scope to prevent prototype collision.
  // All vars are always available under env.VAR_NAME regardless.
  const rootEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(envObj)) {
    if (SAFE_ENV_KEY.test(k)) rootEnv[k] = v
  }
  const jailRoot = ctx.security.jailRoot ?? ctx.docDir ?? null
  const file = makeFileHelpers(jailRoot)

  // Skill context — all Claude Code slash command variables available in @if conditions
  const skill = ctx.skillContext
  const ARGUMENTS = skill?.args ?? ''
  const argsList = skill?.argsList ?? []
  const skillNamedArgs = skill?.namedArgs ?? {}

  const sandbox: Record<string, unknown> = {
    ...rootEnv,
    env: envObj,
    file,
    consumer: ctx.consumer ?? '',
    // $ARGUMENTS and shorthand
    ARGUMENTS,
    args: ARGUMENTS,
    argsList,
    arg0: argsList[0] ?? '',
    arg1: argsList[1] ?? '',
    arg2: argsList[2] ?? '',
    arg3: argsList[3] ?? '',
    // Named args spread into root scope (frontmatter arguments: [issue, branch] → $issue, $branch)
    ...skillNamedArgs,
    // Session and environment variables from Claude Code
    CLAUDE_SESSION_ID: skill?.sessionId ?? '',
    CLAUDE_EFFORT: skill?.effort ?? '',
    CLAUDE_SKILL_DIR: skill?.skillDir ?? '',
  }
  try {
    return runInNewContext(preprocessExpr(expr), sandbox, { timeout: 500 })
  } catch (err) {
    if ((err as Error)?.name === 'ReferenceError') return undefined
    ctx.warnings.push(`Unresolvable expression: ${expr.trim()}`)
    return undefined
  }
}
