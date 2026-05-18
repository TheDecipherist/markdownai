/**
 * MCP input validation — centralised guards for all tool handlers.
 *
 * All user-supplied strings that reach a tool handler pass through
 * validateMcpInput before being used. This catches injection attempts,
 * oversized payloads, and invalid character sequences before they reach
 * the parser or filesystem.
 */

/** Maximum byte length accepted for any single string input field. */
const MAX_INPUT_BYTES = 65_536

/** Characters that have no legitimate use in file paths passed via MCP. */
const PATH_INJECTION_RE = /[\0\r\n]/

/** Characters that should not appear in environment variable names. */
const ENV_KEY_INJECTION_RE = /[^A-Za-z0-9_]/

export interface McpValidationError {
  field: string
  reason: string
}

export interface McpValidationResult {
  ok: boolean
  errors: McpValidationError[]
}

/**
 * Validate a single MCP string input field.
 *
 * @param field - Human-readable field name (for error messages).
 * @param value - The value to validate.
 * @param opts  - Optional constraints.
 */
function validateField(
  field: string,
  value: unknown,
  opts: { maxBytes?: number; noPathInjection?: boolean; isEnvKey?: boolean } = {}
): McpValidationError | null {
  if (typeof value !== 'string') {
    return { field, reason: `must be a string, got ${typeof value}` }
  }
  const limit = opts.maxBytes ?? MAX_INPUT_BYTES
  if (Buffer.byteLength(value, 'utf8') > limit) {
    return { field, reason: `exceeds maximum allowed size (${limit} bytes)` }
  }
  if (opts.noPathInjection && PATH_INJECTION_RE.test(value)) {
    return { field, reason: 'contains disallowed characters (null byte or newline)' }
  }
  if (opts.isEnvKey && ENV_KEY_INJECTION_RE.test(value)) {
    return { field, reason: 'env key contains characters outside [A-Za-z0-9_]' }
  }
  return null
}

/**
 * Validate a map of named MCP inputs.
 *
 * Each entry specifies a field name, its value, and optional constraints.
 * Returns a result object with `ok` and an array of `errors`.
 *
 * @example
 * const result = validateMcpInput([
 *   { field: 'path', value: args.path, noPathInjection: true },
 *   { field: 'phase', value: args.phase },
 * ])
 * if (!result.ok) return { error: result.errors.map(e => `${e.field}: ${e.reason}`).join('; ') }
 */
export function validateMcpInput(
  inputs: Array<{
    field: string
    value: unknown
    maxBytes?: number
    noPathInjection?: boolean
    isEnvKey?: boolean
    optional?: boolean
  }>
): McpValidationResult {
  const errors: McpValidationError[] = []

  for (const input of inputs) {
    if (input.optional && (input.value === undefined || input.value === null)) continue
    const fieldOpts: { maxBytes?: number; noPathInjection?: boolean; isEnvKey?: boolean } = {}
    if (input.maxBytes !== undefined) fieldOpts.maxBytes = input.maxBytes
    if (input.noPathInjection !== undefined) fieldOpts.noPathInjection = input.noPathInjection
    if (input.isEnvKey !== undefined) fieldOpts.isEnvKey = input.isEnvKey
    const err = validateField(input.field, input.value, fieldOpts)
    if (err) errors.push(err)
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Validate an env record: all keys must be safe env variable names,
 * all values must be strings within the size limit.
 */
export function validateEnvRecord(env: unknown): McpValidationError[] {
  if (env === undefined || env === null) return []
  if (typeof env !== 'object' || Array.isArray(env)) {
    return [{ field: 'env', reason: 'must be an object' }]
  }
  const errors: McpValidationError[] = []
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    const keyErr = validateField(`env.${k} (key)`, k, { isEnvKey: true })
    if (keyErr) errors.push(keyErr)
    const valErr = validateField(`env.${k}`, v)
    if (valErr) errors.push(valErr)
  }
  return errors
}
