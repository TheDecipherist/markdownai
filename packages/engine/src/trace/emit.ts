import { appendFile } from 'node:fs'
import type { TraceConfig } from './config.js'
import type { TraceSpan } from './span.js'

export function emitSpan(span: TraceSpan, config: TraceConfig): void {
  const line = JSON.stringify(span) + '\n'
  if (config.sink === 'stderr') {
    process.stderr.write(line)
    return
  }
  if (config.sink === 'file') {
    appendFile(config.path, line, () => undefined)
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
