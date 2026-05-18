import type { HttpSecurityConfig } from './config.js'
import { HTTP_ALWAYS_BLOCK_DOMAINS } from './rules.js'

export type HttpCheckTier = 'always_block' | 'denied_domain' | 'not_enabled' | 'not_allowed' | 'allowed'

export interface HttpCheckResult {
  allowed: boolean
  tier: HttpCheckTier
  reason: string
}

export function checkHttpUrl(url: string, config: HttpSecurityConfig, method = 'GET'): HttpCheckResult {
  let hostname: string
  try {
    const raw = new URL(url).hostname
    // Node.js returns IPv6 addresses with brackets: [fd00:ec2::254] — strip them for comparison
    hostname = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw
  } catch {
    return { allowed: false, tier: 'not_allowed', reason: 'Invalid URL' }
  }

  // 1. Cloud metadata endpoints always blocked — immutable rule
  for (const blocked of HTTP_ALWAYS_BLOCK_DOMAINS) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
      return { allowed: false, tier: 'always_block', reason: `Cloud metadata endpoint always blocked: ${blocked}` }
    }
    // Handle IP prefix wildcards (169.254.*)
    if (blocked.endsWith('*')) {
      const prefix = blocked.slice(0, -1)
      if (hostname.startsWith(prefix)) {
        return { allowed: false, tier: 'always_block', reason: `Cloud metadata range always blocked: ${blocked}` }
      }
    }
  }

  // 2. HTTP disabled
  if (!config.enabled) return { allowed: false, tier: 'not_enabled', reason: 'HTTP requests disabled' }

  // 3. User denied domains
  for (const domain of config.denied_domains) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return { allowed: false, tier: 'denied_domain', reason: `Domain in deny list: ${domain}` }
    }
  }

  // 4. User allowed domains (empty = allow all)
  if (config.allowed_domains.length > 0) {
    const inAllowlist = config.allowed_domains.some(d => hostname === d || hostname.endsWith(`.${d}`))
    if (!inAllowlist) return { allowed: false, tier: 'not_allowed', reason: 'Domain not in allowlist' }
  }

  // 5. Method allowed
  if (config.allowed_methods.length > 0 && !config.allowed_methods.includes(method.toUpperCase())) {
    return { allowed: false, tier: 'not_allowed', reason: `Method "${method.toUpperCase()}" not in allowed_methods` }
  }

  return { allowed: true, tier: 'allowed', reason: 'Allowed' }
}
