import type { DbAdapter, QueryPlan, Row } from '../query.js'
import { Pool } from 'pg'
import { buildSql, normalizeRow } from './sql-shared.js'

export class PostgresAdapter implements DbAdapter {
  private pool: Pool | null = null

  async connect(uri: string): Promise<void> {
    this.pool = new Pool({ connectionString: uri })
    // Verify connection is reachable
    const client = await this.pool.connect()
    client.release()
  }

  async execute(plan: QueryPlan): Promise<Row[]> {
    if (!this.pool) throw new Error('@db postgres: not connected — call connect() first')
    const { sql, params } = buildSql(plan, 'postgres')
    const result = await this.pool.query(sql, params as unknown[])
    return result.rows.map(row => normalizeCount(normalizeRow(row as Record<string, unknown>), plan.operation))
  }

  async executeRaw(query: string): Promise<Row[]> {
    if (!this.pool) throw new Error('@db postgres: not connected')
    const result = await this.pool.query(query)
    return result.rows.map(row => normalizeRow(row as Record<string, unknown>))
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
      const client = await this.pool.connect()
      client.release()
      return true
    } catch {
      return false
    }
  }
}

// PostgreSQL returns COUNT(*) as a string — coerce to number
function normalizeCount(row: Row, operation: QueryPlan['operation']): Row {
  if (operation === 'count' && typeof row['count'] === 'string') {
    return { ...row, count: Number(row['count']) }
  }
  return row
}
