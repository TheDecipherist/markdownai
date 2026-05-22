import { parentPort } from 'node:worker_threads'
import type { EngineEvent } from '../context.js'
import type { EventSecurityConfig } from '../security/config.js'
import { fireLog } from './log.js'
import { fireVscode } from './vscode.js'
import { fireFile, resolveDocRoot } from './file.js'
import { fireHttp } from './http.js'
import { fireDb } from './db.js'

export interface DispatchMessage {
  event: EngineEvent
  config: EventSecurityConfig
  sessionId: string
  httpAllowedDomains: string[]
}

if (!parentPort) throw new Error('dispatch-worker must run as a worker thread')

parentPort.on('message', (msg: DispatchMessage) => {
  const { event, config, sessionId, httpAllowedDomains } = msg
  dispatchOne(event, config, sessionId, httpAllowedDomains)
})

function dispatchOne(
  event: EngineEvent,
  config: EventSecurityConfig,
  sessionId: string,
  httpAllowedDomains: string[]
): void {
  try {
    switch (event.transport) {
      case 'log':
        fireLog(event)
        break
      case 'vscode':
        fireVscode(event, sessionId)
        break
      case 'file': {
        const transportCfg = config.transports?.[event.transport]
        const filePath = transportCfg?.path ?? ''
        if (!filePath) {
          onWorkerError('file', event, 'no path configured', config.onError)
          return
        }
        fireFile(event, filePath, resolveDocRoot(event))
        break
      }
      case 'http': {
        const transportCfg = config.transports?.[event.transport]
        const url = transportCfg?.url ?? ''
        const headers = transportCfg?.headers ?? {}
        if (!url) {
          onWorkerError('http', event, 'no url configured', config.onError)
          return
        }
        fireHttp(event, url, headers, httpAllowedDomains)
        break
      }
      case 'db':
        fireDb(event, config.transports?.[event.transport]?.connection ?? '', config.transports?.[event.transport]?.collection ?? '')
        break
      case 'websocket':
        // websocket clients are not serialisable across the worker boundary;
        // the ws transport is a no-op from the worker — handled by the engine directly if a server is active
        break
      default: {
        // custom transport — resolve its underlying type and re-dispatch
        const custom = config.transports?.[event.transport]
        if (!custom) {
          onWorkerError(event.transport, event, 'unknown transport', config.onError)
          return
        }
        const remapped: EngineEvent = { ...event, transport: custom.type }
        dispatchOne(remapped, config, sessionId, httpAllowedDomains)
        break
      }
    }
  } catch (err) {
    onWorkerError(event.transport, event, String(err), config.onError)
  }
}

function onWorkerError(transport: string, event: EngineEvent, reason: string, onError: string): void {
  // 'fail' degrades to 'warn' in worker context — execute() has already returned
  if (onError === 'silence') return
  process.stderr.write(`[event-worker] transport=${transport} name=${event.name} error=${reason}\n`)
}
