import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve, isAbsolute } from 'node:path'
import { FILESYSTEM_ALWAYS_BLOCK_PATHS, matchGlob } from './rules.js'

const EXTRA_LOG_BLOCK_PREFIXES: readonly string[] = Object.freeze(['/bin/', '/sbin/', '/usr/bin/', '/dev/'])

function isSafeLogPath(logPath: string): boolean {
  const abs = isAbsolute(logPath) ? logPath : resolve(homedir(), '.markdownai', logPath)
  if (FILESYSTEM_ALWAYS_BLOCK_PATHS.some(pattern => matchGlob(pattern, abs))) return false
  return !EXTRA_LOG_BLOCK_PREFIXES.some(prefix => abs.startsWith(prefix))
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
