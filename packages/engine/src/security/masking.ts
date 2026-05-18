import type { FilesystemSecurityConfig } from './config.js'
import { matchGlob } from './rules.js'

const BUILT_IN_MASKING_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /(?:api[_-]?key|apikey)\s*[:=]\s*\S+/gi, name: 'api-key' },
  { re: /(?:secret|token)\s*[:=]\s*\S+/gi, name: 'secret-token' },
  { re: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, name: 'password' },
  { re: /(?:PRIVATE_KEY|private_key)\s*[:=]\s*\S+/g, name: 'private-key-env' },
  { re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, name: 'bearer-token' },
  { re: /(?:AKIA|ABIA|ACCA)[A-Z0-9]{16}/g, name: 'aws-key' },
  { re: /(?:AWS_SESSION_TOKEN|aws_session_token)\s*[:=]\s*\S+/g, name: 'aws-session-token' },
  { re: /gh[pousr]_[A-Za-z0-9_]{36}/g, name: 'github-token' },
  { re: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g, name: 'stripe-key' },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g, name: 'private-key-pem' },
  { re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, name: 'jwt' },
  { re: /mongodb(?:\+srv)?:\/\/[^/\s]+:[^@\s]+@[^\s]+/g, name: 'mongodb-uri' },
  { re: /postgres(?:ql)?:\/\/[^/\s]+:[^@\s]+@[^\s]+/g, name: 'postgres-uri' },
  { re: /^[A-Z][A-Z0-9_]+=(?=[A-Za-z0-9+/]{32,})[A-Za-z0-9+/=_-]{32,}$/gm, name: 'env-value' },
]

const MAX_USER_PATTERN_LENGTH = 200
// Simple heuristic for catastrophic backtracking: nested quantifiers like (a+)+ or (.*)*
const REDOS_SUSPECT = /(\([^)]*[+*][^)]*\)[+*]|\(\?[^)]*\)[+*][+*]|\.\*.*\.\*)/

export function applyMasking(
  content: string,
  config?: FilesystemSecurityConfig,
  filePath?: string
): { masked: string; wasMasked: boolean; alert?: string } {
  // Skip masking if file path is in allow_unmasked_paths — emit SECURITY_ALERT when this fires
  if (filePath && config?.allow_unmasked_paths?.length) {
    if (config.allow_unmasked_paths.some(p => matchGlob(p, filePath))) {
      return {
        masked: content,
        wasMasked: false,
        alert: `SECURITY_ALERT: masking bypassed via allow_unmasked_paths for: ${filePath}`,
      }
    }
  }

  let result = content
  let wasMasked = false

  for (const { re } of BUILT_IN_MASKING_PATTERNS) {
    const replaced = result.replace(re, '***MASKED***')
    if (replaced !== result) { wasMasked = true; result = replaced }
  }

  if (config?.user_masking_patterns?.length) {
    for (const pattern of config.user_masking_patterns) {
      if (typeof pattern !== 'string' || pattern.length > MAX_USER_PATTERN_LENGTH) continue
      if (REDOS_SUSPECT.test(pattern)) {
        return { masked: result, wasMasked, alert: `WARN: user_masking_pattern rejected (suspected ReDoS): ${pattern}` }
      }
      try {
        const re = new RegExp(pattern, 'g')
        const replaced = result.replace(re, '***MASKED***')
        if (replaced !== result) { wasMasked = true; result = replaced }
      } catch {
        return { masked: result, wasMasked, alert: `WARN: invalid user_masking_pattern — skipped: ${pattern}` }
      }
    }
  }

  return { masked: result, wasMasked }
}
