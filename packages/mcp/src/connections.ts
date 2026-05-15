export interface ConnectionEntry {
  name: string
  type: string
  args: Record<string, string>
}

// Session-scoped connection registry — established at server startup, reused across calls
const connections = new Map<string, ConnectionEntry>()

export function registerConnection(name: string, type: string, args: Record<string, string>): void {
  connections.set(name, { name, type, args })
}

export function getConnection(name: string): ConnectionEntry | null {
  return connections.get(name) ?? null
}

export function listConnections(): ConnectionEntry[] {
  return [...connections.values()]
}

export function clearConnections(): void {
  connections.clear()
}
