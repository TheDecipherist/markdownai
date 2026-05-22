import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { EngineEvent } from '../context.js'
import type { EventSecurityConfig } from '../security/config.js'

const INTERNAL_TRANSPORTS = new Set(['mcp'])
const BUILT_IN_EXTERNAL = new Set(['log', 'vscode', 'websocket', 'file', 'http', 'db'])

let worker: Worker | null = null

function getWorker(): Worker {
  if (worker) return worker
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'dispatch-worker.js')
  worker = new Worker(workerPath)
  worker.unref()
  return worker
}

export interface DispatchMessage {
  event: EngineEvent
  config: EventSecurityConfig
}

export function dispatchExternal(event: EngineEvent, config: EventSecurityConfig): void {
  const w = getWorker()
  const msg: DispatchMessage = { event, config }
  w.postMessage(msg)
}

export function resolveTransportType(name: string, config: EventSecurityConfig): 'mcp' | 'external' | 'custom' | 'unknown' {
  if (name === 'mcp') return 'mcp'
  if (BUILT_IN_EXTERNAL.has(name)) return 'external'
  if (config.transports?.[name]) return 'custom'
  return 'unknown'
}

export { INTERNAL_TRANSPORTS, BUILT_IN_EXTERNAL }
