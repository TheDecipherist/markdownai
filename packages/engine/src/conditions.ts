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

function runExpr(expr: string, ctx: EngineContext): unknown {
  const sandbox: Record<string, unknown> = { ...ctx.env, ...ctx.envFiles, file }
  try {
    return runInNewContext(expr, sandbox, { timeout: 500 })
  } catch {
    return undefined
  }
}
