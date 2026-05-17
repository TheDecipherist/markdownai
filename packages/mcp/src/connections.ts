const SENSITIVE_VALUE_PATTERN = /SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL|PRIVATE|AUTH|CERT/i
// Regex patterns that detect connection string secrets embedded in values
const CONNECTION_STRING_PATTERNS = [
  /mongodb(?:\+srv)?:\/\/[^/\s]+:[^@\s]+@/,
  /postgres(?:ql)?:\/\/[^/\s]+:[^@\s]+@/,
  /mysql:\/\/[^/\s]+:[^@\s]+@/,
  /:[^@\s]{8,}@/,  // generic user:password@ pattern (8+ chars to avoid false-positives on port numbers)
]

function maskArgValue(key: string, value: string): string {
  if (SENSITIVE_VALUE_PATTERN.test(key)) return '***MASKED***'
  for (const re of CONNECTION_STRING_PATTERNS) {
    if (re.test(value)) return value.replace(re, (m) => m.replace(/:([^@]+)@/, ':***MASKED***@'))
  }
  return value
}

function maskArgs(args: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(args)) masked[k] = maskArgValue(k, v)
  return masked
}

export interface ConnectionEntry {
  name: string
  type: string
  args: Record<string, string>
}

// Per-session registry — keyed by sessionId so sessions don't share connections
// Raw (unmasked) args are stored only in the internal Map and never exposed by listConnections
const sessionRegistries = new Map<string, Map<string, ConnectionEntry>>()

function getRegistry(sessionId: string): Map<string, ConnectionEntry> {
  let reg = sessionRegistries.get(sessionId)
  if (!reg) { reg = new Map(); sessionRegistries.set(sessionId, reg) }
  return reg
}

export function registerConnection(name: string, type: string, args: Record<string, string>, sessionId = 'default'): void {
  getRegistry(sessionId).set(name, { name, type, args })
}

export function getConnection(name: string, sessionId = 'default'): ConnectionEntry | null {
  return getRegistry(sessionId).get(name) ?? null
}

/** Returns connections with sensitive arg values masked. Never exposes raw credentials. */
export function listConnections(sessionId = 'default'): Array<ConnectionEntry & { args: Record<string, string> }> {
  return [...getRegistry(sessionId).values()].map(c => ({ ...c, args: maskArgs(c.args) }))
}

export function clearConnections(sessionId = 'default'): void {
  sessionRegistries.delete(sessionId)
}

export function clearAllSessions(): void {
  sessionRegistries.clear()
}
