import type { EngineEvent } from '../context.js'

export function fireLog(event: EngineEvent): void {
  const line = `[event] name=${event.name} data=${event.data} document=${event.document} ts=${event.timestamp}\n`
  process.stderr.write(line)
}
