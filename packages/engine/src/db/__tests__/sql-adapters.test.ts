import { describe, it, expect } from 'vitest'
import type { QueryPlan } from '../query.js'
import { buildSql } from '../adapters/sql-shared.js'

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

function orPlan(overrides: Partial<QueryPlan> = {}): QueryPlan {
  const p = makePlan(overrides)
  Object.defineProperty(p, '_hasOrFilters', { value: true, enumerable: false })
  return p
}

// ---- buildSql tests (pure, no mocks needed) ----

describe('buildSql — SELECT', () => {
  it('find with no filters produces SELECT * FROM table', () => {
    const { sql } = buildSql(makePlan(), 'postgres')
    expect(sql).toBe('SELECT * FROM "users"')
  })

  it('find with columns produces SELECT field AS label', () => {
    const { sql } = buildSql(makePlan({
      columns: [{ field: 'name', label: 'Name' }, { field: 'email', label: 'Email' }],
    }), 'postgres')
    expect(sql).toContain('"name" AS "Name"')
    expect(sql).toContain('"email" AS "Email"')
  })

  it('find with sort produces ORDER BY clause', () => {
    const { sql } = buildSql(makePlan({ sort: [{ field: 'name', dir: 'asc' }] }), 'postgres')
    expect(sql).toContain('ORDER BY "name" ASC')
  })

  it('find with limit produces LIMIT N (non-mssql)', () => {
    const { sql } = buildSql(makePlan({ limit: 10 }), 'postgres')
    expect(sql).toContain('LIMIT 10')
  })

  it('mssql find with limit produces SELECT TOP N', () => {
    const { sql } = buildSql(makePlan({ limit: 10 }), 'mssql')
    expect(sql).toContain('SELECT TOP 10')
    expect(sql).not.toContain('LIMIT')
  })

  it('one operation produces LIMIT 1 (non-mssql)', () => {
    const { sql } = buildSql(makePlan({ operation: 'one' }), 'postgres')
    expect(sql).toContain('LIMIT 1')
  })

  it('mssql one produces SELECT TOP 1', () => {
    const { sql } = buildSql(makePlan({ operation: 'one' }), 'mssql')
    expect(sql).toContain('SELECT TOP 1')
    expect(sql).not.toContain('LIMIT')
  })
})

describe('buildSql — WHERE', () => {
  it('AND filters produce WHERE a = $1 AND b = $2 (postgres)', () => {
    const { sql } = buildSql(makePlan({
      where: [{ field: 'active', operator: '==', value: true }, { field: 'role', operator: '==', value: 'admin' }],
    }), 'postgres')
    expect(sql).toContain('WHERE active = $1 AND role = $2')
  })

  it('OR filters produce WHERE a = $1 OR b = $2 (postgres)', () => {
    const { sql } = buildSql(orPlan({
      where: [{ field: 'status', operator: '==', value: 'a' }, { field: 'status', operator: '==', value: 'b' }],
    }), 'postgres')
    expect(sql).toContain('WHERE status = $1 OR status = $2')
  })

  it('postgres uses $1, $2 placeholders', () => {
    const { sql } = buildSql(makePlan({
      where: [{ field: 'id', operator: '==', value: 1 }],
    }), 'postgres')
    expect(sql).toContain('$1')
  })

  it('mysql uses ? placeholders', () => {
    const { sql } = buildSql(makePlan({
      where: [{ field: 'id', operator: '==', value: 1 }],
    }), 'mysql')
    expect(sql).toContain('WHERE id = ?')
  })

  it('mssql uses @p1, @p2 placeholders', () => {
    const { sql } = buildSql(makePlan({
      where: [{ field: 'id', operator: '==', value: 1 }],
    }), 'mssql')
    expect(sql).toContain('@p1')
  })

  it('sqlite boolean true becomes 1 in params', () => {
    const { params } = buildSql(makePlan({
      where: [{ field: 'active', operator: '==', value: true }],
    }), 'sqlite')
    expect(params[0]).toBe(1)
  })

  it('sqlite boolean false becomes 0 in params', () => {
    const { params } = buildSql(makePlan({
      where: [{ field: 'active', operator: '==', value: false }],
    }), 'sqlite')
    expect(params[0]).toBe(0)
  })

  it('non-sqlite booleans stay as booleans in params', () => {
    const { params } = buildSql(makePlan({
      where: [{ field: 'active', operator: '==', value: true }],
    }), 'postgres')
    expect(params[0]).toBe(true)
  })
})

describe('buildSql — count and aggregate', () => {
  it('count produces SELECT COUNT(*) as count FROM table', () => {
    const { sql } = buildSql(makePlan({ operation: 'count' }), 'postgres')
    expect(sql).toBe('SELECT COUNT(*) as count FROM "users"')
  })

  it('aggregate with group produces GROUP BY clause', () => {
    const { sql } = buildSql(makePlan({
      operation: 'aggregate',
      group: 'status',
      aggregations: [{ func: 'count', field: null, label: 'count' }],
    }), 'postgres')
    expect(sql).toContain('GROUP BY "status"')
  })

  it('aggregate count=true produces COUNT(*) as count', () => {
    const { sql } = buildSql(makePlan({
      operation: 'aggregate',
      group: 'status',
      aggregations: [{ func: 'count', field: null, label: 'count' }],
    }), 'postgres')
    expect(sql).toContain('COUNT(*) AS "count"')
  })

  it('aggregate sum produces SUM(field) as sum_field', () => {
    const { sql } = buildSql(makePlan({
      operation: 'aggregate',
      group: 'category',
      aggregations: [{ func: 'sum', field: 'amount', label: 'sum_amount' }],
    }), 'postgres')
    expect(sql).toContain('SUM("amount") AS "sum_amount"')
  })
})
