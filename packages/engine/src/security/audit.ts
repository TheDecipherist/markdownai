import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve, isAbsolute } from 'node:path'

const BLOCKED_LOG_PREFIXES = ['/etc/', '/proc/', '/sys/', '/bin/', '/sbin/', '/usr/bin/', '/dev/']

function isSafeLogPath(logPath: string): boolean {
  const resolved = isAbsolute(logPath) ? logPath : resolve(homedir(), '.markdownai', logPath)
  return !BLOCKED_LOG_PREFIXES.some(prefix => resolved.startsWith(prefix))
}

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
  if (logPath !== undefined && !isSafeLogPath(logPath)) {
    process.stderr.write(`[markdownai] audit log path rejected (blocked prefix): ${logPath}\n`)
    return
  }
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
