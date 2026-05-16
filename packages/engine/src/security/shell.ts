import type { ShellSecurityConfig } from './config.js'
import { SHELL_ALWAYS_BLOCK, SHELL_ALWAYS_ALERT, matchGlob, matchShellPattern } from './rules.js'

export type ShellCheckTier = 'always_block' | 'always_alert' | 'deny_pattern' | 'not_allowed' | 'allowed'

export interface ShellCheckResult {
  allowed: boolean
  tier: ShellCheckTier
  reason: string
}

export function checkShellCommand(command: string, config: ShellSecurityConfig): ShellCheckResult {
  const cmd = command.trim()

  // 1. Built-in always_block — immutable, no config can override
  for (const pattern of SHELL_ALWAYS_BLOCK) {
    if (matchShellPattern(pattern, cmd)) {
      return { allowed: false, tier: 'always_block', reason: `Immutable block: "${pattern}"` }
    }
  }

  // 2. Built-in always_alert — blocked unless explicitly in user allowlist
  let alertPattern = ''
  for (const pattern of SHELL_ALWAYS_ALERT) {
    if (matchGlob(pattern, cmd) || matchShellPattern(pattern, cmd)) {
      alertPattern = pattern
      break
    }
  }

  // 3. User deny_patterns (deny wins over allow)
  for (const pattern of config.deny_patterns) {
    if (matchGlob(pattern, cmd) || matchShellPattern(pattern, cmd)) {
      return { allowed: false, tier: 'deny_pattern', reason: `User deny pattern: "${pattern}"` }
    }
  }

  // 4. User allowlist check
  const inAllowlist = config.allow_patterns.some(p => matchGlob(p, cmd) || matchShellPattern(p, cmd))

  // enabled:false blocks everything not in always_block (already handled above) — check before allowlist
  if (!config.enabled) return { allowed: false, tier: 'not_allowed', reason: 'Shell execution disabled' }

  if (alertPattern) {
    if (inAllowlist) return { allowed: true, tier: 'always_alert', reason: `Alert pattern in allowlist: "${alertPattern}"` }
    return { allowed: false, tier: 'always_alert', reason: `Alert pattern not in allowlist: "${alertPattern}"` }
  }

  if (!inAllowlist) return { allowed: false, tier: 'not_allowed', reason: 'Command not in allowlist' }

  return { allowed: true, tier: 'allowed', reason: 'In allowlist' }
}
