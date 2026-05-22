import { appendFile } from 'node:fs'
import type { TraceConfig } from './config.js'
import type { TraceSpan } from './span.js'

// Per-path write queues — chains promises so file writes complete in emission order
const fileQueues = new Map<string, Promise<void>>()

function enqueueFileWrite(path: string, data: string): void {
  const current = fileQueues.get(path) ?? Promise.resolve()
  const next = current.then(
    () => new Promise<void>(resolve => appendFile(path, data, () => resolve()))
  )
  fileQueues.set(path, next)
}

export function emitSpan(span: TraceSpan, config: TraceConfig): void {
  const line = JSON.stringify(span) + '\n'
  if (config.sink === 'stderr') {
    process.stderr.write(line)
    return
  }
  if (config.sink === 'file') {
    enqueueFileWrite(config.path, line)
    return
  }
  if (config.sink === 'http') {
    fetch(config.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: line,
    }).catch(() => undefined)
  }
}
