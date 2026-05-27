// Dedicated engine error log.
//
// Captures every error the engine catches and swallows — ReferenceError on
// undefined variables, TypeError on bad property chains, expression timeouts,
// path-resolution failures, etc. — to ~/.markdownai/logs/markdownai-error.log
// so operators can audit them later even when the engine intentionally
// suppresses them at runtime (e.g. ReferenceError during multi-phase
// renders where unset variables are expected).
//
// JSON-lines format, one object per line. Append-only. Failsafe: logging
// failures never propagate to the caller, because observability must never
// break correctness.

import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type ErrorLogDecision = 'suppressed' | 'warned' | 'fatal'

export interface ErrorLogEntry {
  ts: string                              // ISO-8601 timestamp
  pid: number                             // engine process id
  source: string                          // 'evalExpression' | 'evalExpr' | 'resolveWritePath' | etc.
  decision: ErrorLogDecision              // what the engine did with the error
  expression?: string | undefined         // expression that failed (when applicable)
  document?: string | undefined           // document path being rendered (when known)
  phase?: string | undefined              // active phase (when known)
  error_name: string                      // err.name (ReferenceError, TypeError, etc.)
  error_message: string                   // err.message
  detail?: unknown                        // free-form structured detail
}

const LOG_DIR = join(homedir(), '.markdownai', 'logs')
const LOG_PATH = join(LOG_DIR, 'markdownai-error.log')

let initialized = false

function ensureLogDir(): void {
  if (initialized) return
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    initialized = true
  } catch {
    // failsafe: don't break callers
  }
}

/**
 * Log an engine error to ~/.markdownai/logs/markdownai-error.log.
 *
 * `decision` documents what the engine did with this error:
 *   - 'suppressed' — silently swallowed (e.g. ReferenceError on undefined
 *     variables during multi-phase renders, no warning emitted)
 *   - 'warned' — pushed onto ctx.warnings so the caller sees it
 *   - 'fatal' — rethrown to abort the render
 *
 * `source` names the call site so consumers can grep for specific
 * subsystems (evalExpression, evalExpr, resolveWritePath, etc.).
 */
export function logEngineError(entry: Omit<ErrorLogEntry, 'ts' | 'pid'>): void {
  ensureLogDir()
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    pid: process.pid,
    ...entry,
  })
  try {
    appendFileSync(LOG_PATH, line + '\n', 'utf8')
  } catch {
    // failsafe
  }
}

export function engineErrorLogPath(): string {
  return LOG_PATH
}
