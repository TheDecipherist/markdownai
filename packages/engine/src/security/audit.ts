import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export type AuditLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'SECURITY_ALERT' | 'SECURITY_NOTICE'
export type AuditAction = 'ALLOWED' | 'BLOCKED' | 'STRIPPED' | 'MASKED' | 'ALERTED'

export interface AuditEntry {
  level: AuditLevel
  directive: string
  file: string
  line: number
  message: string
  action: AuditAction
  rule?: string
  pid?: number
  uid?: number
}

export function writeAuditEntry(entry: AuditEntry, logPath?: string): void {
  const path = logPath ?? join(homedir(), '.markdownai', 'audit.log')
  const enriched = {
    ...entry,
    timestamp: new Date().toISOString(),
    pid: entry.pid ?? process.pid,
    uid: entry.uid ?? (typeof process.getuid === 'function' ? process.getuid() : undefined),
  }
  const line = JSON.stringify(enriched) + '\n'
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, line, 'utf8')
  } catch (err) {
    process.stderr.write(`[markdownai] audit log write failed (${path}): ${String(err)}\n`)
  }
}
