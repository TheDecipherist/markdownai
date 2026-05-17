import type { QueryPlan, Row, ParsedQuery, DbAdapter } from './query.js'
import type { CacheConfig } from '@markdownai/parser'
import { cacheKey, readCache, writeCache } from '../cache.js'
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

export interface ExecuteOptions {
  cacheConfig?: CacheConfig
  strict?: boolean
}

export type { DbAdapter }

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

function getConnectionAllowRaw(name: string, config: DbSecurityConfig): boolean {
  return config[name]?.allow_raw === true
}

function checkConnectionSecurity(
  operation: string,
  collection: string,
  connName: string,
  config: DbSecurityConfig,
): string | null {
  const conn = config[connName]
  if (!conn) return null

  if (conn.denied_operations.length > 0 && conn.denied_operations.includes(operation)) {
    return `Operation "${operation}" is denied for connection "${connName}"`
  }

  if (conn.allowed_operations.length > 0 && !conn.allowed_operations.includes(operation)) {
    return `Operation "${operation}" is not in allowed_operations for connection "${connName}"`
  }

  if (conn.denied_collections.length > 0 && conn.denied_collections.includes(collection)) {
    return `Collection "${collection}" is denied for connection "${connName}"`
  }

  if (conn.allowed_collections.length > 0 && !conn.allowed_collections.includes(collection)) {
    return `Collection "${collection}" is not in allowed_collections for connection "${connName}"`
  }

  return null
}

function applyMaxResults(
  rows: Row[],
  connName: string,
  config: DbSecurityConfig,
): { rows: Row[]; cap: number | null } {
  const maxResults = config[connName]?.max_results ?? 1000
  if (rows.length > maxResults) return { rows: rows.slice(0, maxResults), cap: maxResults }
  return { rows, cap: null }
}

function buildDbCacheKey(plan: QueryPlan, connection: ResolvedConnection): string {
  return cacheKey('db', {
    connection: connection.name,
    uri: connection.uri,
    operation: plan.operation,
    collection: plan.collection,
    where: plan.where,
    sort: plan.sort,
    limit: plan.limit,
    columns: plan.columns,
    group: plan.group,
    aggregations: plan.aggregations,
  })
}

export async function execute(
  parsed: ParsedQuery,
  connection: ResolvedConnection,
  securityConfig: DbSecurityConfig,
  options?: ExecuteOptions,
): Promise<Row[]> {
  if (parsed.kind === 'raw') {
    return executeRaw(parsed.query, connection, securityConfig)
  }
  return executePlan(parsed.plan, connection, securityConfig, options)
}

async function executePlan(
  plan: QueryPlan,
  connection: ResolvedConnection,
  securityConfig: DbSecurityConfig,
  options?: ExecuteOptions,
): Promise<Row[]> {
  const secBlock = checkConnectionSecurity(plan.operation, plan.collection, connection.name, securityConfig)
  if (secBlock) {
    writeAuditEntry({
      level: 'ERROR',
      directive: '@db',
      file: connection.name,
      line: 0,
      message: secBlock,
      action: 'BLOCKED',
    })
    throw new Error(`@db: ${secBlock}`)
  }

  if (options?.cacheConfig && options.cacheConfig.mode !== 'mock') {
    const key = buildDbCacheKey(plan, connection)
    const cached = readCache(key, options.cacheConfig)
    if (cached !== null) return JSON.parse(cached) as Row[]
  }

  if (!isSupportedType(connection.type)) {
    throw new Error(`@db: unsupported database type "${connection.type}" — supported: ${supported_types.join(', ')}`)
  }
  const adapter = adapterRegistry.get(connection.type)
  if (!adapter) return []

  let rows: Row[]
  try {
    rows = await adapter.execute(plan)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeAuditEntry({
      level: 'ERROR',
      directive: '@db',
      file: connection.name,
      line: 0,
      message: `Runtime error: ${msg}`,
      action: 'BLOCKED',
    })
    if (options?.strict) throw err
    return []
  }

  const { rows: capped, cap } = applyMaxResults(rows, connection.name, securityConfig)
  if (cap !== null) {
    writeAuditEntry({
      level: 'WARN',
      directive: '@db',
      file: connection.name,
      line: 0,
      message: `Result truncated to max_results (${cap}) — query returned more rows`,
      action: 'STRIPPED',
    })
  }

  if (options?.cacheConfig && options.cacheConfig.mode !== 'mock') {
    const key = buildDbCacheKey(plan, connection)
    writeCache(key, JSON.stringify(capped), options.cacheConfig)
  }

  return capped
}

export async function executeRaw(
  query: string,
  connection: ResolvedConnection,
  securityConfig: DbSecurityConfig,
): Promise<Row[]> {
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

  if (!getConnectionAllowRaw(connection.name, securityConfig)) {
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
