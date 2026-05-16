import { runInNewContext } from 'node:vm'
import { existsSync, statSync } from 'node:fs'
import type { EngineContext } from './context.js'

const file = {
  exists: (p: string): boolean => existsSync(p),
  isFile: (p: string): boolean => {
    try { return statSync(p).isFile() } catch { return false }
  },
  isDir: (p: string): boolean => {
    try { return statSync(p).isDirectory() } catch { return false }
  },
}

export function evalCondition(expr: string, ctx: EngineContext): boolean {
  return Boolean(runExpr(expr, ctx))
}

export function evalExpression(expr: string, ctx: EngineContext): string {
  const result = runExpr(expr, ctx)
  return result === undefined ? '' : String(result)
}

function preprocessExpr(expr: string): string {
  // Convert file.exists "./path" → file.exists("./path") (and isFile, isDir)
  return expr.replace(/\bfile\.(exists|isFile|isDir)\s+"([^"]*)"/g, 'file.$1("$2")')
             .replace(/\bfile\.(exists|isFile|isDir)\s+'([^']*)'/g, "file.$1('$2')")
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
  const sandbox: Record<string, unknown> = { ...rootEnv, env: envObj, file }
  try {
    return runInNewContext(preprocessExpr(expr), sandbox, { timeout: 500 })
  } catch {
    return undefined
  }
}
