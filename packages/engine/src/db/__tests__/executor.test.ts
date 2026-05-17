import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execute, executeRaw, registerAdapter, supported_types } from '../executor.js'
import type { DbAdapter, ExecuteOptions } from '../executor.js'
import { parseQuery } from '../query.js'
import type { QueryPlan, Row } from '../query.js'
import type { DbSecurityConfig } from '../../security/config.js'
import { clearSessionCache } from '../../cache.js'

const emptySecurityConfig: DbSecurityConfig = {}

function makeConnConfig(overrides: Partial<{
  allowed_operations: string[]
  denied_operations: string[]
  denied_keywords: string[]
  allowed_collections: string[]
  denied_collections: string[]
  allow_raw: boolean
  readonly: boolean
  max_results: number
}> = {}) {
  return {
    allowed_operations: [],
    denied_operations: [],
    denied_keywords: [],
    allowed_collections: [],
    denied_collections: [],
    allow_raw: false,
    readonly: true,
    max_results: 1000,
    ...overrides,
  }
}

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
    const secConfig: DbSecurityConfig = { primary: makeConnConfig({ allow_raw: true }) }
    await expect(executeRaw('DROP TABLE users', conn, secConfig)).rejects.toThrow('SECURITY_ALERT')
  })

  it('blocks raw queries containing MongoDB drop pattern', async () => {
    const conn = { type: 'mongodb', uri: 'mongodb://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = { primary: makeConnConfig({ allow_raw: true }) }
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
    const secConfig: DbSecurityConfig = { 'allowed-conn': makeConnConfig({ allow_raw: true }) }
    const rows = await executeRaw('SELECT 1', conn, secConfig)
    expect(stub.executeRaw).toHaveBeenCalledWith('SELECT 1')
    expect(rows).toEqual([{ result: 1 }])
  })
})

describe('execute — collection security (72-db-security)', () => {
  it('blocks a query on a collection in denied_collections', async () => {
    const stub = makeStubAdapter([{ id: 1 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ denied_collections: ['users'] }),
    }
    const parsed = parseQuery({ find: 'users' }, {})
    await expect(execute(parsed, conn, secConfig)).rejects.toThrow('denied')
    expect(stub.execute).not.toHaveBeenCalled()
  })

  it('blocks a query on a collection not in allowed_collections', async () => {
    const stub = makeStubAdapter([{ id: 1 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ allowed_collections: ['orders'] }),
    }
    const parsed = parseQuery({ find: 'users' }, {})
    await expect(execute(parsed, conn, secConfig)).rejects.toThrow('not in allowed_collections')
    expect(stub.execute).not.toHaveBeenCalled()
  })

  it('allows a query on a collection in allowed_collections', async () => {
    const stub = makeStubAdapter([{ id: 1 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ allowed_collections: ['users'] }),
    }
    const parsed = parseQuery({ find: 'users' }, {})
    const rows = await execute(parsed, conn, secConfig)
    expect(rows).toEqual([{ id: 1 }])
  })

  it('denied_collections takes precedence even when collection is in allowed_collections', async () => {
    const stub = makeStubAdapter([{ id: 1 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ allowed_collections: ['users'], denied_collections: ['users'] }),
    }
    const parsed = parseQuery({ find: 'users' }, {})
    await expect(execute(parsed, conn, secConfig)).rejects.toThrow('denied')
    expect(stub.execute).not.toHaveBeenCalled()
  })
})

describe('execute — operation security (72-db-security)', () => {
  it('blocks an operation in denied_operations', async () => {
    const stub = makeStubAdapter([])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ denied_operations: ['count'] }),
    }
    const parsed = parseQuery({ count: 'events' }, {})
    await expect(execute(parsed, conn, secConfig)).rejects.toThrow('denied')
    expect(stub.execute).not.toHaveBeenCalled()
  })

  it('blocks an operation not in allowed_operations', async () => {
    const stub = makeStubAdapter([])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ allowed_operations: ['find', 'one'] }),
    }
    const parsed = parseQuery({ count: 'events' }, {})
    await expect(execute(parsed, conn, secConfig)).rejects.toThrow('not in allowed_operations')
    expect(stub.execute).not.toHaveBeenCalled()
  })

  it('connection with no config inherits permissive defaults', async () => {
    const stub = makeStubAdapter([{ id: 1 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'unconfigured' }
    const secConfig: DbSecurityConfig = {}
    const parsed = parseQuery({ find: 'users' }, {})
    const rows = await execute(parsed, conn, secConfig)
    expect(rows).toEqual([{ id: 1 }])
  })
})

describe('execute — max_results truncation (72-db-security)', () => {
  it('truncates result to max_results when adapter returns more rows', async () => {
    const manyRows: Row[] = Array.from({ length: 1500 }, (_, i) => ({ id: i }))
    const stub = makeStubAdapter(manyRows)
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ max_results: 1000 }),
    }
    const parsed = parseQuery({ find: 'events' }, {})
    const rows = await execute(parsed, conn, secConfig)
    expect(rows).toHaveLength(1000)
    expect(rows[0]).toEqual({ id: 0 })
    expect(rows[999]).toEqual({ id: 999 })
  })

  it('does not truncate when result is within max_results', async () => {
    const stub = makeStubAdapter([{ id: 1 }, { id: 2 }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const secConfig: DbSecurityConfig = {
      primary: makeConnConfig({ max_results: 1000 }),
    }
    const parsed = parseQuery({ find: 'events' }, {})
    const rows = await execute(parsed, conn, secConfig)
    expect(rows).toHaveLength(2)
  })
})

describe('execute — caching (73-db-caching)', () => {
  beforeEach(() => {
    clearSessionCache()
  })

  it('returns cached rows on second call with @cache session', async () => {
    const rows1: Row[] = [{ id: 1, name: 'Alice' }]
    const stub = makeStubAdapter(rows1)
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const parsed = parseQuery({ find: 'users' }, {})
    const opts: ExecuteOptions = { cacheConfig: { mode: 'session' } }

    const first = await execute(parsed, conn, emptySecurityConfig, opts)
    expect(first).toEqual(rows1)
    expect(stub.execute).toHaveBeenCalledTimes(1)

    // Mutate stub return to different data — cache should still return original
    stub.execute = vi.fn().mockResolvedValue([{ id: 99, name: 'Changed' }])
    const second = await execute(parsed, conn, emptySecurityConfig, opts)
    expect(second).toEqual(rows1)
    expect(stub.execute).not.toHaveBeenCalled()
  })

  it('two directives with identical options share a cache hit', async () => {
    const rows: Row[] = [{ count: 42 }]
    const stub = makeStubAdapter(rows)
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'primary' }
    const parsed = parseQuery({ find: 'orders', where: 'status==pending' }, {})
    const opts: ExecuteOptions = { cacheConfig: { mode: 'session' } }

    await execute(parsed, conn, emptySecurityConfig, opts)
    await execute(parsed, conn, emptySecurityConfig, opts)
    expect(stub.execute).toHaveBeenCalledTimes(1)
  })

  it('raw queries are not auto-cached — always hit the adapter', async () => {
    const stub = makeStubAdapter([{ result: 'x' }])
    registerAdapter('postgres', stub)
    const conn = { type: 'postgres', uri: 'postgres://localhost/test', name: 'raw-conn' }
    const secConfig: DbSecurityConfig = { 'raw-conn': makeConnConfig({ allow_raw: true }) }

    // raw queries go through executeRaw, not the caching path
    await executeRaw('SELECT 1', conn, secConfig)
    await executeRaw('SELECT 1', conn, secConfig)
    expect(stub.executeRaw).toHaveBeenCalledTimes(2)
  })
})

describe('execute — runtime error handling (74-db-error-handling)', () => {
  it('returns empty array and does not throw on adapter error (default mode)', async () => {
    const stub: DbAdapter = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      ping: vi.fn().mockResolvedValue(false),
      execute: vi.fn().mockRejectedValue(new Error('connection refused')),
      executeRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
    }
    registerAdapter('mysql', stub)
    const conn = { type: 'mysql', uri: 'mysql://localhost/test', name: 'primary' }
    const parsed = parseQuery({ find: 'users' }, {})
    const rows = await execute(parsed, conn, emptySecurityConfig)
    expect(rows).toEqual([])
  })

  it('throws on adapter error when strict=true', async () => {
    const stub: DbAdapter = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      ping: vi.fn().mockResolvedValue(false),
      execute: vi.fn().mockRejectedValue(new Error('connection refused')),
      executeRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
    }
    registerAdapter('mssql', stub)
    const conn = { type: 'mssql', uri: 'mssql://localhost/test', name: 'primary' }
    const parsed = parseQuery({ find: 'users' }, {})
    await expect(execute(parsed, conn, emptySecurityConfig, { strict: true })).rejects.toThrow('connection refused')
  })
})

describe('parseQuery — error context (74-db-error-handling)', () => {
  it('attaches file and line context to DbParseError', async () => {
    const { DbParseError } = await import('../query.js')
    let caught: InstanceType<typeof DbParseError> | null = null
    try {
      parseQuery({ find: 'users', count: 'users' }, {}, { file: './docs/status.md', line: 34 })
    } catch (err) {
      if (err instanceof DbParseError) caught = err
    }
    expect(caught).not.toBeNull()
    expect(caught!.context.file).toBe('./docs/status.md')
    expect(caught!.context.line).toBe(34)
  })

  it('format() includes file and line when present', async () => {
    const { DbParseError } = await import('../query.js')
    const err = new DbParseError('@db: test error', { file: './docs/test.md', line: 5 })
    const formatted = err.format()
    expect(formatted).toContain('./docs/test.md')
    expect(formatted).toContain('5')
  })

  it('format() returns plain message when no context', async () => {
    const { DbParseError } = await import('../query.js')
    const err = new DbParseError('@db: test error')
    expect(err.format()).toBe('@db: test error')
  })
})
