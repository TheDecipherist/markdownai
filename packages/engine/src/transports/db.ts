import type { EngineEvent } from '../context.js'

export function fireDb(
  event: EngineEvent,
  connection: string,
  collection: string
): void {
  process.stderr.write(
    `[event-db] connection=${connection} collection=${collection} name=${event.name}\n`
  )
}
