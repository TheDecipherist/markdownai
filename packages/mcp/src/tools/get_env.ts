// Sensitive key patterns — MCP callers must never be able to read these
const DENIED_KEY_PATTERNS = /SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL|PRIVATE|AUTH|CERT|API_|DATABASE|CONNECTION_STRING/i

export interface GetEnvResult {
  value: string
  found: boolean
  denied?: boolean
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
  if (!key || typeof key !== 'string') return { value: '', found: false }

  // Reject keys that don't look like valid env var names
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)) return { value: '', found: false }

  if (DENIED_KEY_PATTERNS.test(key)) {
    return { value: '', found: false, denied: true }
  }

  // If an allowlist of document-declared keys is provided, enforce it
  if (allowedKeys && !allowedKeys.has(key)) {
    return { value: '', found: false, denied: true }
  }

  const value = process.env[key]
  if (value !== undefined) return { value, found: true }
  if (fallback !== undefined) return { value: fallback, found: false }
  return { value: '', found: false }
}
