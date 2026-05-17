import type { QueryPlan, Row, ParsedQuery } from './query.js'
import { DB_ALWAYS_BLOCK_KEYWORDS, DB_ALWAYS_BLOCK_MONGO } from '../security/rules.js'
import { writeAuditEntry } from '../security/audit.js'
import type { DbSecurityConfig } from '../security/config.js'

export const supported_types = ['mongodb', 'postgres', 'mysql', 'mssql', 'sqlite'] as const
export type DbType = typeof supported_types[number]

export interface ResolvedConnection {
  type: string
  uri: string
  name: string
}

// DbAdapter interface — implemented by each database adapter in Wave 2
export interface DbAdapter {
  connect(uri: string): Promise<void>
  disconnect(): Promise<void>
  ping(): Promise<boolean>
  execute(plan: QueryPlan): Promise<Row[]>
  executeRaw(query: string): Promise<Row[]>
}

// Adapter registry — populated as adapters are registered
const adapterRegistry = new Map<string, DbAdapter>()

export function registerAdapter(type: DbType, adapter: DbAdapter): void {
  adapterRegistry.set(type, adapter)
}

function isSupportedType(type: string): type is DbType {
  return (supported_types as readonly string[]).includes(type)
}

function checkRawAlwaysBlock(query: string): string | null {
  const upper = query.toUpperCase()
  for (const kw of DB_ALWAYS_BLOCK_KEYWORDS) {
    if (upper.includes(kw)) return `Immutable block keyword: "${kw}"`
  }
  const lower = query.toLowerCase()
  for (const pattern of DB_ALWAYS_BLOCK_MONGO) {
    if (lower.includes(pattern.toLowerCase())) return `Immutable block MongoDB pattern: "${pattern}"`
  }
  return null
}

function getConnectionAllowRaw(name: string, securityConfig: DbSecurityConfig): boolean {
  // allow_raw is not a standard field on DbConnectionSecurityConfig
  // Access it via type assertion for now — will be typed in Wave 3 (72-db-security)
  const connConfig = securityConfig[name] as (typeof securityConfig[string] & { allow_raw?: boolean }) | undefined
  return connConfig?.allow_raw === true
}

export async function execute(
  parsed: ParsedQuery,
  connection: ResolvedConnection,
  securityConfig: DbSecurityConfig,
): Promise<Row[]> {
  if (parsed.kind === 'raw') {
    return executeRaw(parsed.query, connection, securityConfig)
  }
  return executePlan(parsed.plan, connection)
}

async function executePlan(plan: QueryPlan, connection: ResolvedConnection): Promise<Row[]> {
  if (!isSupportedType(connection.type)) {
    throw new Error(`@db: unsupported database type "${connection.type}" — supported: ${supported_types.join(', ')}`)
  }
  const adapter = adapterRegistry.get(connection.type)
  if (!adapter) {
    // No adapter registered yet (Wave 2 will provide them). Return empty — not a fatal error during Wave 1.
    return []
  }
  return adapter.execute(plan)
}

export async function executeRaw(
  query: string,
  connection: ResolvedConnection,
  securityConfig: DbSecurityConfig,
): Promise<Row[]> {
  // Always-block check — immutable rules, applied before allow_raw check
  const blockReason = checkRawAlwaysBlock(query)
  if (blockReason) {
    writeAuditEntry({
      level: 'SECURITY_ALERT',
      directive: '@db raw=',
      file: connection.name,
      line: 0,
      message: `Raw query blocked by immutable rule: ${blockReason}`,
      action: 'BLOCKED',
      rule: blockReason,
    })
    throw new Error(`SECURITY_ALERT: @db raw= blocked — ${blockReason}`)
  }

  // allow_raw check — per-connection security config
  const allowRaw = getConnectionAllowRaw(connection.name, securityConfig)
  if (!allowRaw) {
    writeAuditEntry({
      level: 'WARN',
      directive: '@db raw=',
      file: connection.name,
      line: 0,
      message: 'Raw query stripped — allow_raw not enabled for this connection',
      action: 'STRIPPED',
    })
    return []
  }

  // Unconditional audit log for all raw executions — cannot be suppressed
  writeAuditEntry({
    level: 'WARN',
    directive: '@db raw=',
    file: connection.name,
    line: 0,
    message: `Raw query executed on connection "${connection.name}"`,
    action: 'ALLOWED',
  })

  if (!isSupportedType(connection.type)) {
    throw new Error(`@db: unsupported database type "${connection.type}"`)
  }
  const adapter = adapterRegistry.get(connection.type)
  if (!adapter) return []
  return adapter.executeRaw(query)
}
