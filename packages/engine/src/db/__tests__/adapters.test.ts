import { describe, it, expect } from 'vitest'
import type { DbAdapter } from '../query.js'
import { MongoDbAdapter } from '../adapters/mongodb.js'
import { PostgresAdapter } from '../adapters/postgres.js'
import { MysqlAdapter } from '../adapters/mysql.js'
import { MssqlAdapter } from '../adapters/mssql.js'
import { SqliteAdapter } from '../adapters/sqlite.js'

const adapters: Array<[string, DbAdapter]> = [
  ['MongoDbAdapter', new MongoDbAdapter()],
  ['PostgresAdapter', new PostgresAdapter()],
  ['MysqlAdapter', new MysqlAdapter()],
  ['MssqlAdapter', new MssqlAdapter()],
  ['SqliteAdapter', new SqliteAdapter()],
]

describe('DbAdapter interface — ping() contract', () => {
  for (const [name, adapter] of adapters) {
    it(`${name}: ping() returns false (not throws) when not connected`, async () => {
      const result = await adapter.ping()
      expect(result).toBe(false)
    })
  }
})

describe('DbAdapter interface — disconnect() contract', () => {
  for (const [name, adapter] of adapters) {
    it(`${name}: disconnect() does not throw when not connected`, async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined()
    })
  }
})

describe('DbAdapter interface — structure', () => {
  for (const [name, adapter] of adapters) {
    it(`${name}: implements all DbAdapter methods`, () => {
      expect(typeof adapter.connect).toBe('function')
      expect(typeof adapter.disconnect).toBe('function')
      expect(typeof adapter.ping).toBe('function')
      expect(typeof adapter.execute).toBe('function')
      expect(typeof adapter.executeRaw).toBe('function')
    })
  }
})
