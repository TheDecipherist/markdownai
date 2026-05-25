// Dedicated MCP server activity log.
//
// Writes one JSON object per line to ~/.markdownai/logs/markdownai-mcp.log so
// operators can `tail -f` the file and watch every tool call, request, and
// response in real time while a slash-command / agent session is running.
//
// This is separate from the AST-level trace (engine/trace/). MCP-level events
// are about the server's RPC surface, not directive execution.

import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type McpLogLevel = 'info' | 'warn' | 'error'

export interface McpLogEntry {
  ts: string                            // ISO-8601 timestamp
  pid: number                           // server process id (so multiple sessions are distinguishable)
  level: McpLogLevel
  event: string                         // 'server-start' | 'request' | 'response' | 'tool-call' | 'tool-result' | 'tool-error' | 'shutdown' | etc.
  id?: string | number | undefined      // JSON-RPC request id when applicable
  method?: string | undefined           // JSON-RPC method or tool name
  tool?: string | undefined             // tool name on tools/call
  args_summary?: string | undefined     // short rendering of args (truncated; full args go to detail when small enough)
  detail?: unknown                      // free-form structured detail
  error?: string | undefined            // error message for tool-error
  duration_ms?: number | undefined      // measured for tool-result
}

const LOG_DIR = join(homedir(), '.markdownai', 'logs')
const LOG_PATH = join(LOG_DIR, 'markdownai-mcp.log')
const MAX_DETAIL_SUMMARY = 240

let initialized = false

function ensureLogDir(): void {
  if (initialized) return
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    initialized = true
  } catch {
    // If the log dir can't be created we silently no-op. The MCP server must
    // not fail because logging is unavailable — logging is observability,
    // not correctness.
  }
}

function summarizeValue(v: unknown): string {
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'string') return v.length > MAX_DETAIL_SUMMARY ? v.slice(0, MAX_DETAIL_SUMMARY) + '…' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    const s = JSON.stringify(v)
    return s.length > MAX_DETAIL_SUMMARY ? s.slice(0, MAX_DETAIL_SUMMARY) + '…' : s
  } catch {
    return '[unserializable]'
  }
}

export function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return summarizeValue(args)
  const entries: string[] = []
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    entries.push(`${k}=${summarizeValue(v)}`)
  }
  const joined = entries.join(', ')
  return joined.length > MAX_DETAIL_SUMMARY ? joined.slice(0, MAX_DETAIL_SUMMARY) + '…' : joined
}

export function mcpLog(entry: Omit<McpLogEntry, 'ts' | 'pid'>): void {
  ensureLogDir()
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    pid: process.pid,
    ...entry,
  })
  try {
    appendFileSync(LOG_PATH, line + '\n', 'utf8')
  } catch {
    // See ensureLogDir — logging failures must not break the server.
  }
}

export function mcpLogPath(): string {
  return LOG_PATH
}
