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

function runExpr(expr: string, ctx: EngineContext): unknown {
  const envObj = { ...ctx.env, ...ctx.envFiles }
  const sandbox: Record<string, unknown> = { ...envObj, env: envObj, file }
  try {
    return runInNewContext(preprocessExpr(expr), sandbox, { timeout: 500 })
  } catch {
    return undefined
  }
}
