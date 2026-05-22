import type { EngineEvent } from '../context.js'

export function fireMcp(event: EngineEvent, events: EngineEvent[]): void {
  events.push(event)
}
