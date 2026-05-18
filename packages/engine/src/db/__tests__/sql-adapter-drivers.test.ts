import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { QueryPlan } from '../query.js'

// ---- Helpers ----

function makePlan(overrides: Partial<QueryPlan> = {}): QueryPlan {
  return {
    operation: 'find',
    collection: 'users',
    where: [],
    sort: [],
    limit: null,
    columns: [],
    group: null,
    aggregations: [],
    ...overrides,
  }
}

// ---- PostgresAdapter tests ----

const pgQueryFn = vi.fn().mockResolvedValue({ rows: [] })
const pgConnectFn = vi.fn().mockResolvedValue({ release: vi.fn() })
const pgEndFn = vi.fn().mockResolvedValue(undefined)
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: pgQueryFn,
    end: pgEndFn,
    connect: pgConnectFn,
  })),
}))

const { PostgresAdapter } = await import('../adapters/postgres.js')

describe('PostgresAdapter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('execute() calls pool.query() with SQL and params', async () => {
    const a = new PostgresAdapter()
    await a.connect('postgresql://localhost/testdb')
    vi.clearAllMocks()
    pgQueryFn.mockResolvedValueOnce({ rows: [{ name: 'Alice' }] })
    const rows = await a.execute(makePlan())
    expect(pgQueryFn).toHaveBeenCalled()
    expect(rows[0]!.name).toBe('Alice')
  })

  it('count returns [{ count: N }] as number (not string)', async () => {
    const a = new PostgresAdapter()
    await a.connect('postgresql://localhost/testdb')
    vi.clearAllMocks()
    pgQueryFn.mockResolvedValueOnce({ rows: [{ count: '42' }] })
    const rows = await a.execute(makePlan({ operation: 'count' }))
    expect(rows[0]!.count).toBe(42)
    expect(typeof rows[0]!.count).toBe('number')
  })

  it('ping() returns false when not connected', async () => {
    const a = new PostgresAdapter()
    expect(await a.ping()).toBe(false)
  })

  it('disconnect() ends the pool', async () => {
    const a = new PostgresAdapter()
    await a.connect('postgresql://localhost/testdb')
    vi.clearAllMocks()
    await a.disconnect()
    expect(pgEndFn).toHaveBeenCalledOnce()
  })
})

// ---- MysqlAdapter tests ----

const mysqlExecuteFn = vi.fn().mockResolvedValue([[]])
const mysqlEndFn = vi.fn().mockResolvedValue(undefined)
const mysqlConnFn = vi.fn().mockResolvedValue({ release: vi.fn() })
vi.mock('mysql2/promise', () => ({
  createPool: vi.fn().mockImplementation(() => ({
    execute: mysqlExecuteFn,
    end: mysqlEndFn,
    getConnection: mysqlConnFn,
  })),
}))

const { MysqlAdapter } = await import('../adapters/mysql.js')

describe('MysqlAdapter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('execute() calls pool.execute() with SQL and params', async () => {
    const a = new MysqlAdapter()
    await a.connect('mysql://localhost/testdb')
    vi.clearAllMocks()
    mysqlExecuteFn.mockResolvedValueOnce([[{ name: 'Bob' }], []])
    const rows = await a.execute(makePlan())
    expect(mysqlExecuteFn).toHaveBeenCalled()
    expect(rows[0]!.name).toBe('Bob')
  })

  it('ping() returns false when not connected', async () => {
    const a = new MysqlAdapter()
    expect(await a.ping()).toBe(false)
  })
})

// ---- SqliteAdapter tests ----

const sqliteAllFn = vi.fn().mockReturnValue([])
const sqliteGetFn = vi.fn().mockReturnValue(undefined)
const mockStmt = { all: sqliteAllFn, get: sqliteGetFn }
const sqliteCloseFn = vi.fn()
const mockSqliteDb = {
  prepare: vi.fn().mockReturnValue(mockStmt),
  close: sqliteCloseFn,
}
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => mockSqliteDb),
}))

const { SqliteAdapter } = await import('../adapters/sqlite.js')

describe('SqliteAdapter', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('execute() wraps synchronous better-sqlite3 calls', async () => {
    const a = new SqliteAdapter()
    await a.connect(':memory:')
    vi.clearAllMocks()
    sqliteAllFn.mockReturnValueOnce([{ name: 'Carol' }])
    const rows = await a.execute(makePlan())
    expect(mockSqliteDb.prepare).toHaveBeenCalled()
    expect(rows[0]!.name).toBe('Carol')
  })

  it('boolean true in params coerced to 1', async () => {
    const a = new SqliteAdapter()
    await a.connect(':memory:')
    vi.clearAllMocks()
    await a.execute(makePlan({
      where: [{ field: 'active', operator: '==', value: true }],
    }))
    const calledParams = (mockStmt.all as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
    expect(calledParams[0]).toBe(1)
  })

  it('boolean false in params coerced to 0', async () => {
    const a = new SqliteAdapter()
    await a.connect(':memory:')
    vi.clearAllMocks()
    await a.execute(makePlan({
      where: [{ field: 'active', operator: '==', value: false }],
    }))
    const calledParams = (mockStmt.all as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[]
    expect(calledParams[0]).toBe(0)
  })

  it('ping() returns false when not connected', async () => {
    const a = new SqliteAdapter()
    expect(await a.ping()).toBe(false)
  })
})
