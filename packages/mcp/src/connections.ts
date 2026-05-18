import { applyMasking } from '@markdownai/engine'
import type { FilesystemSecurityConfig } from '@markdownai/engine'

const SENSITIVE_KEY_PATTERN = /SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL|PRIVATE|AUTH|CERT/i

function maskArgValue(key: string, value: string, securityConfig?: FilesystemSecurityConfig): string {
  // Mask by key name first (catches fields that may not contain patterns but are semantically sensitive)
  if (SENSITIVE_KEY_PATTERN.test(key)) return '***MASKED***'
  // Then apply engine content masking to catch embedded secrets in values (URIs, bearer tokens, etc.)
  const { masked } = applyMasking(value, securityConfig)
  return masked
}

function maskArgs(args: Record<string, string>, securityConfig?: FilesystemSecurityConfig): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(args)) masked[k] = maskArgValue(k, v, securityConfig)
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
export function listConnections(sessionId = 'default', securityConfig?: FilesystemSecurityConfig): Array<ConnectionEntry & { args: Record<string, string> }> {
  return [...getRegistry(sessionId).values()].map(c => ({ ...c, args: maskArgs(c.args, securityConfig) }))
}

export function clearConnections(sessionId = 'default'): void {
  sessionRegistries.delete(sessionId)
}

export function clearAllSessions(): void {
  sessionRegistries.clear()
}
