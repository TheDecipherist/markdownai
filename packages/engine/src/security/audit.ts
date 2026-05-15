import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export type AuditLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'SECURITY_ALERT' | 'SECURITY_NOTICE'
export type AuditAction = 'ALLOWED' | 'BLOCKED' | 'STRIPPED' | 'MASKED'

export interface AuditEntry {
  level: AuditLevel
  directive: string
  file: string
  line: number
  message: string
  action: AuditAction
}

export function writeAuditEntry(entry: AuditEntry, logPath?: string): void {
  const path = logPath ?? join(homedir(), '.markdownai', 'audit.log')
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n'
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, line, 'utf8')
  } catch { /* write failures are silent */ }
}
