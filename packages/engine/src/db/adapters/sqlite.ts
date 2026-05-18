import type { DbAdapter, QueryPlan, Row } from '../query.js'
import Database from 'better-sqlite3'
import { buildSql, normalizeRow } from './sql-shared.js'

export class SqliteAdapter implements DbAdapter {
  private db: InstanceType<typeof Database> | null = null

  async connect(uri: string): Promise<void> {
    // uri for SQLite is a file path (or :memory: for in-memory).
    // Callers are responsible for jailRoot validation before calling connect.
    if (uri !== ':memory:' && /\.\.(\/|\\)/.test(uri)) {
      throw new Error(`@db sqlite: path traversal rejected: "${uri}"`)
    }
    this.db = new Database(uri)
  }

  async execute(plan: QueryPlan): Promise<Row[]> {
    if (!this.db) throw new Error('@db sqlite: not connected — call connect() first')
    const { sql, params } = buildSql(plan, 'sqlite')
    // better-sqlite3 is synchronous — wrap to satisfy async interface
    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as Record<string, unknown>[]
    return rows.map(row => normalizeRow(row))
  }

  async executeRaw(query: string): Promise<Row[]> {
    if (!this.db) throw new Error('@db sqlite: not connected')
    // Security: always call through executor.executeRaw() which enforces allow_raw and denied_keywords guards.
    const rows = this.db.prepare(query).all() as Record<string, unknown>[]
    return rows.map(row => normalizeRow(row))
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  async ping(): Promise<boolean> {
    if (!this.db) return false
    try {
      this.db.prepare('SELECT 1').get()
      return true
    } catch {
      return false
    }
  }
}
