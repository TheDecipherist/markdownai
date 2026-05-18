import { validateMcpInput } from '../validate.js'

// Sensitive key patterns — MCP callers must never be able to read these
const DENIED_KEY_PATTERNS = /SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL|PRIVATE|AUTH|CERT|API_|DATABASE|CONNECTION_STRING/i

export interface GetEnvResult {
  value: string
  found: boolean
  denied?: boolean
}

/**
 * Returns true if `key` is a valid, non-sensitive env var name.
 * Optionally restricted to an explicit allowlist of document-declared keys.
 */
export function filterEnvKeys(key: string, allowedKeys?: ReadonlySet<string>): boolean {
  if (!key || typeof key !== 'string') return false
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)) return false
  if (DENIED_KEY_PATTERNS.test(key)) return false
  if (allowedKeys !== undefined && !allowedKeys.has(key)) return false
  return true
}

/**
 * Returns a document-declared env var by name.
 * Rejects any key matching sensitive patterns to prevent MCP callers from
 * exfiltrating secrets (AWS_SECRET_ACCESS_KEY, DATABASE_URL, OPENAI_API_KEY, etc.).
 */
export function getEnv(
  key: string,
  fallback?: string,
  allowedKeys?: ReadonlySet<string>
): GetEnvResult {
  const validation = validateMcpInput([{ field: 'key', value: key, isEnvKey: true }])
  if (!validation.ok) return { value: '', found: false }

  if (!filterEnvKeys(key, allowedKeys)) {
    const denied = DENIED_KEY_PATTERNS.test(key) || (allowedKeys !== undefined && !allowedKeys.has(key))
    return { value: '', found: false, denied }
  }

  const value = process.env[key]
  if (value !== undefined) return { value, found: true }
  if (fallback !== undefined) return { value: fallback, found: false }
  return { value: '', found: false }
}
