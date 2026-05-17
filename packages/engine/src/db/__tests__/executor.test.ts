import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execute, executeRaw, registerAdapter, supported_types } from '../executor.js'
import type { DbAdapter } from '../executor.js'
import { parseQuery } from '../query.js'
import type { QueryPlan, Row } from '../query.js'
import type { DbSecurityConfig } from '../../security/config.js'

const emptySecurityConfig: DbSecurityConfig = {}

function makeStubAdapter(rows: Row[] = []): DbAdapter {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue(rows),
    executeRaw: vi.fn().mockResolvedValue(rows),
  }
}

describe('supported_types', () => {
  it('includes all five database types', () => {
    expect(supported_types).toContain('mongodb')
    expect(supported_types).toContain('postgres')
    expect(supported_types).toContain('mysql')
    expect(supported_types).toContain('mssql')
    expect(supported_types).toContain('sqlite')
  })

  it('does not include unsupported types', () => {
    expect((supported_types as readonly string[]).includes('redis')).toBe(false)
    expect((supported_types as readonly string[]).includes('cassandra')).toBe(false)
  })
})

describe('execute — routing', () => {
  beforeEach(() => {
    // Clean registry by re-registering fresh stubs
  })

  it('routes a plan to the registered adapter', async () => {
    const stub = makeStubAdapter([{ name: 'Alice', active: true }])
    registerAdapter('postgres', stub)

    const parsed = parseQuery({ find: 'users' }, {})
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const rows = await execute(parsed, conn, emptySecurityConfig)

    expect(stub.execute).toHaveBeenCalledOnce()
    expect(rows).toEqual([{ name: 'Alice', active: true }])
  })

  it('raises error for unsupported connection type', async () => {
    const parsed = parseQuery({ find: 'users' }, {})
    const conn = { type: 'oracle', uri: 'oracle://localhost', name: 'primary' }
    await expect(execute(parsed, conn, emptySecurityConfig)).rejects.toThrow('unsupported database type')
  })
})

describe('executeRaw — security', () => {
  it('blocks raw queries containing immutable SQL block keyword DROP TABLE', async () => {
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = { primary: { allowed_operations: [], denied_keywords: [], allowed_collections: [], readonly: true, max_results: 1000, allow_raw: true } as unknown as typeof secConfig['primary'] }
    await expect(executeRaw('DROP TABLE users', conn, secConfig)).rejects.toThrow('SECURITY_ALERT')
  })

  it('blocks raw queries containing MongoDB drop pattern', async () => {
    const conn = { type: 'mongodb', uri: 'mongodb://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = { primary: { allowed_operations: [], denied_keywords: [], allowed_collections: [], readonly: true, max_results: 1000, allow_raw: true } as unknown as typeof secConfig['primary'] }
    await expect(executeRaw('db.users.drop()', conn, secConfig)).rejects.toThrow('SECURITY_ALERT')
  })

  it('strips raw query and returns [] when allow_raw is false', async () => {
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const rows = await executeRaw('SELECT 1', conn, emptySecurityConfig)
    expect(rows).toEqual([])
  })

  it('executes raw query when allow_raw is true', async () => {
    const stub = makeStubAdapter([{ result: 1 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'allowed-conn' }
    const secConfig = { 'allowed-conn': { allowed_operations: [], denied_keywords: [], allowed_collections: [], readonly: false, max_results: 1000, allow_raw: true } } as unknown as DbSecurityConfig
    const rows = await executeRaw('SELECT 1', conn, secConfig)
    expect(stub.executeRaw).toHaveBeenCalledWith('SELECT 1')
    expect(rows).toEqual([{ result: 1 }])
  })
})
