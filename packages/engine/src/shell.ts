import { execSync } from 'node:child_process'
import type { EngineContext } from './context.js'

export function runShell(command: string, input: string[], ctx: EngineContext): string[] {
  if (!ctx.security.allowShell) {
    throw new Error(`Shell execution denied (security.allowShell=false): ${command}`)
  }
  const result = execSync(command, {
    input: input.join('\n'),
    cwd: ctx.cwd,
    encoding: 'utf8',
    timeout: 10_000,
  })
  return result.split('\n').filter(l => l !== '')
}
