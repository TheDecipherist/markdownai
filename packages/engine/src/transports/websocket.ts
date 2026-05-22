import type { EngineEvent } from '../context.js'

export interface WebsocketClient {
  send: (data: string) => void
}

export function fireWebsocket(
  event: EngineEvent,
  clients: Set<WebsocketClient>
): void {
  if (clients.size === 0) return

  const payload = JSON.stringify(event)

  for (const client of clients) {
    try {
      client.send(payload)
    } catch (err) {
      process.stderr.write(
        `[event-websocket] client send failed name=${event.name} err=${err instanceof Error ? err.message : String(err)}\n`
      )
    }
  }
}
