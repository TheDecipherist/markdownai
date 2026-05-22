import { appendFileSync } from 'node:fs'
import type { EngineEvent } from '../context.js'

export function fireVscode(event: EngineEvent, sessionId: string): void {
  const filePath = `/tmp/markdownai-events-${sessionId}.json`

  let parsedData: unknown = event.data
  try {
    parsedData = JSON.parse(event.data)
  } catch {
    // keep raw string if not valid JSON
  }

  const entry = {
    name: event.name,
    data: parsedData,
    transport: event.transport,
    document: event.document,
    phase: event.phase,
    timestamp: event.timestamp,
  }

  appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8')
}
