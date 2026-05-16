export type RuntimeMode = 'silent' | 'verbose' | 'strict'
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'SECURITY_ALERT' | 'SECURITY_NOTICE'

const ALWAYS_TERMINAL = new Set<LogLevel>(['ERROR', 'FATAL', 'SECURITY_ALERT', 'SECURITY_NOTICE'])

export function shouldPrintToTerminal(level: LogLevel, mode: RuntimeMode): boolean {
  if (ALWAYS_TERMINAL.has(level)) return true
  if (mode === 'verbose') return true  // verbose emits all levels
  return false
}

export function isStrictViolation(level: LogLevel, mode: RuntimeMode): boolean {
  if (mode !== 'strict') return false
  return level === 'WARN' || ALWAYS_TERMINAL.has(level)
}
