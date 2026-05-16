import type { DbSecurityConfig } from './config.js'
import { DB_ALWAYS_BLOCK_KEYWORDS, DB_ALWAYS_BLOCK_MONGO } from './rules.js'

export type DbCheckTier = 'always_block' | 'denied_keyword' | 'allowed'

export interface DbCheckResult {
  allowed: boolean
  tier: DbCheckTier
  reason: string
}

export function checkDbOperation(
  operation: string,
  connection: string,
  config: DbSecurityConfig
): DbCheckResult {
  const op = operation.trim()
  const upperOp = op.toUpperCase()

  // 1. Always-block SQL keywords — immutable
  for (const keyword of DB_ALWAYS_BLOCK_KEYWORDS) {
    if (upperOp.includes(keyword)) {
      return { allowed: false, tier: 'always_block', reason: `Immutable block keyword: "${keyword}"` }
    }
  }

  // 2. Always-block MongoDB patterns — immutable (case-insensitive to prevent bypass)
  const lowerOp = op.toLowerCase()
  for (const pattern of DB_ALWAYS_BLOCK_MONGO) {
    if (lowerOp.includes(pattern.toLowerCase())) {
      return { allowed: false, tier: 'always_block', reason: `Immutable block MongoDB pattern: "${pattern}"` }
    }
  }

  const connConfig = config[connection]
  if (!connConfig) return { allowed: true, tier: 'allowed', reason: 'No restrictions for this connection' }

  // 3. User denied keywords (per connection)
  for (const keyword of connConfig.denied_keywords) {
    if (upperOp.includes(keyword.toUpperCase())) {
      return { allowed: false, tier: 'denied_keyword', reason: `Denied keyword: "${keyword}"` }
    }
  }

  return { allowed: true, tier: 'allowed', reason: 'Operation allowed' }
}
