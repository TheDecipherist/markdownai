import { execSync } from 'node:child_process'
import type { EngineContext } from './context.js'
import { checkShellCommand } from './security/shell.js'
import type { ShellSecurityConfig } from './security/config.js'

export function runShell(command: string, input: string[], ctx: EngineContext): string[] {
  const shellConfig: ShellSecurityConfig = ctx.security.shellConfig ?? {
    enabled: ctx.security.allowShell,
    allow_patterns: [],
    deny_patterns: [],
    allow_network: false,
    require_confirmation: false,
    audit_log: false,
  }

  const result = checkShellCommand(command, shellConfig)
  if (!result.allowed) {
    throw new Error(`Shell command blocked [${result.tier}]: ${result.reason}`)
  }

  const output = execSync(command, {
    input: input.join('\n'),
    cwd: ctx.cwd,
    encoding: 'utf8',
    timeout: 10_000,
  })
  return output.split('\n').filter(l => l !== '')
}
