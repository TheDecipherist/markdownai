import type { DbAdapter, QueryPlan, Row } from '../query.js'
import { createPool, type Pool } from 'mysql2/promise'
import { buildSql, normalizeRow } from './sql-shared.js'

export class MysqlAdapter implements DbAdapter {
  private pool: Pool | null = null

  async connect(uri: string): Promise<void> {
    this.pool = createPool(uri)
    // Verify connection
    const conn = await this.pool.getConnection()
    conn.release()
  }

  async execute(plan: QueryPlan): Promise<Row[]> {
    if (!this.pool) throw new Error('@db mysql: not connected — call connect() first')
    const { sql, params } = buildSql(plan, 'mysql')
    const [rows] = await this.pool.execute(sql, params as import('mysql2').ExecuteValues[])
    return (rows as Record<string, unknown>[]).map(row => normalizeRow(row))
  }

  async executeRaw(query: string): Promise<Row[]> {
    if (!this.pool) throw new Error('@db mysql: not connected')
    const [rows] = await this.pool.execute(query)
    return (rows as Record<string, unknown>[]).map(row => normalizeRow(row))
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  async ping(): Promise<boolean> {
    if (!this.pool) return false
    try {
      const conn = await this.pool.getConnection()
      conn.release()
      return true
    } catch {
      return false
    }
  }
}
