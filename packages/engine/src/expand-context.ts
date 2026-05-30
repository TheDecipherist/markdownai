import type { EngineContext } from './context.js'
import type { PatternExpandContext } from './security/path-expand.js'

export function buildExpandContext(ctx: EngineContext): PatternExpandContext {
  const env: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const expandCtx: PatternExpandContext = { env }
  const skillDir = ctx.skillContext?.skillDir
  const sessionId = ctx.skillContext?.sessionId
  if (skillDir) expandCtx.skillDir = skillDir
  if (sessionId) expandCtx.sessionId = sessionId
  if (ctx.cwd) expandCtx.cwd = ctx.cwd
  return expandCtx
}
