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

// Per-session registry stores pre-masked connections — safe for display/enumeration.
// Raw credentials live only in credentialVault and are never surfaced externally.
const sessionRegistries = new Map<string, Map<string, ConnectionEntry>>()
const credentialVault = new Map<string, Map<string, Record<string, string>>>()

function getRegistry(sessionId: string): Map<string, ConnectionEntry> {
  let reg = sessionRegistries.get(sessionId)
  if (!reg) { reg = new Map(); sessionRegistries.set(sessionId, reg) }
  return reg
}

function getVault(sessionId: string): Map<string, Record<string, string>> {
  let v = credentialVault.get(sessionId)
  if (!v) { v = new Map(); credentialVault.set(sessionId, v) }
  return v
}

export function registerConnection(name: string, type: string, args: Record<string, string>, sessionId = 'default', securityConfig?: FilesystemSecurityConfig): void {
  // Mask before storing in the connections singleton (contract: applyMasking before storage)
  const masked = maskArgs(args, securityConfig)
  getRegistry(sessionId).set(name, { name, type, args: masked })
  // Raw credentials stored separately for actual connection use — never exposed externally
  getVault(sessionId).set(name, args)
}

/** Returns raw connection credentials for internal engine use. Never pass this result to user-facing output. */
export function getConnection(name: string, sessionId = 'default'): ConnectionEntry | null {
  const raw = getVault(sessionId).get(name)
  if (!raw) return null
  const entry = getRegistry(sessionId).get(name)
  if (!entry) return null
  return { name: entry.name, type: entry.type, args: raw }
}

/** Returns connections with sensitive arg values masked. Safe for display. */
export function listConnections(sessionId = 'default', _securityConfig?: FilesystemSecurityConfig): Array<ConnectionEntry> {
  return [...getRegistry(sessionId).values()]
}

export function clearConnections(sessionId = 'default'): void {
  sessionRegistries.delete(sessionId)
  credentialVault.delete(sessionId)
}

export function clearAllSessions(): void {
  sessionRegistries.clear()
  credentialVault.clear()
}
