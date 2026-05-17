import type { DbAdapter, QueryPlan, Row } from '../query.js'
import * as mssql from 'mssql'
import { buildSql, normalizeRow } from './sql-shared.js'

export class MssqlAdapter implements DbAdapter {
  private pool: mssql.ConnectionPool | null = null

  async connect(uri: string): Promise<void> {
    this.pool = await mssql.connect(uri)
  }

  async execute(plan: QueryPlan): Promise<Row[]> {
    if (!this.pool) throw new Error('@db mssql: not connected — call connect() first')
    const { sql, params } = buildSql(plan, 'mssql')
    const request = this.pool.request()
    params.forEach((p, i) => { request.input(`p${i + 1}`, p) })
    const result = await request.query(sql)
    return result.recordset.map(row => normalizeRow(row as Record<string, unknown>))
  }

  async executeRaw(query: string): Promise<Row[]> {
    if (!this.pool) throw new Error('@db mssql: not connected')
    const result = await this.pool.request().query(query)
    return result.recordset.map(row => normalizeRow(row as Record<string, unknown>))
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close()
      this.pool = null
    }
  }

  async ping(): Promise<boolean> {
    if (!this.pool) return false
    try {
      await this.pool.request().query('SELECT 1')
      return true
    } catch {
      return false
    }
  }
}
