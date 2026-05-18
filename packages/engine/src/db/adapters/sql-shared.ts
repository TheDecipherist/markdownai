import type { QueryPlan, Filter, ColumnMap, SortTerm, AggregateOp } from '../query.js'

export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'sqlite'

export interface SqlBuild {
  sql: string
  params: unknown[]
}

export function buildSql(plan: QueryPlan, dialect: SqlDialect): SqlBuild {
  const params: unknown[] = []
  let paramIdx = 1

  function addParam(value: unknown): string {
    const coerced = dialect === 'sqlite' && typeof value === 'boolean' ? (value ? 1 : 0) : value
    params.push(coerced)
    const ph = placeholder(dialect, paramIdx++)
    return ph
  }

  const hasOr = plan._hasOrFilters === true

  // WHERE
  let where = ''
  if (plan.where.length > 0) {
    const clauses = plan.where.map(f => {
      const ph = addParam(f.value)
      return buildWhereExpr(f, ph, dialect)
    })
    where = 'WHERE ' + clauses.join(hasOr ? ' OR ' : ' AND ')
  }

  let sql: string

  switch (plan.operation) {
    case 'count': {
      const parts = [`SELECT COUNT(*) as count`, `FROM ${qi(plan.collection, dialect)}`]
      if (where) parts.push(where)
      sql = parts.join(' ')
      break
    }
    case 'aggregate': {
      const groupCol = qi(plan.group!, dialect)
      const aggCols = plan.aggregations.map(op => buildAggExpr(op, dialect))
      const selectCols = [groupCol, ...aggCols].join(', ')
      const parts = [`SELECT ${selectCols}`, `FROM ${qi(plan.collection, dialect)}`]
      if (where) parts.push(where)
      parts.push(`GROUP BY ${groupCol}`)
      sql = parts.join(' ')
      break
    }
    case 'one': {
      const selectClause = `SELECT ${mssqlTop(1, dialect)}${buildSelectCols(plan.columns, dialect)}`
      const parts = [selectClause, `FROM ${qi(plan.collection, dialect)}`]
      if (where) parts.push(where)
      if (dialect !== 'mssql') parts.push('LIMIT 1')
      sql = parts.join(' ')
      break
    }
    default: { // find
      const topClause = plan.limit !== null && dialect === 'mssql' ? mssqlTop(plan.limit, dialect) : ''
      const selectClause = `SELECT ${topClause}${buildSelectCols(plan.columns, dialect)}`
      const parts = [selectClause, `FROM ${qi(plan.collection, dialect)}`]
      if (where) parts.push(where)
      if (plan.sort.length > 0) {
        const terms = plan.sort.map(s => `${qi(s.field, dialect)} ${s.dir.toUpperCase()}`)
        parts.push('ORDER BY ' + terms.join(', '))
      }
      if (plan.limit !== null && dialect !== 'mssql') parts.push(`LIMIT ${plan.limit}`)
      sql = parts.join(' ')
    }
  }

  return { sql, params }
}

function placeholder(dialect: SqlDialect, idx: number): string {
  switch (dialect) {
    case 'postgres': return `$${idx}`
    case 'mysql':    return '?'
    case 'mssql':    return `@p${idx}`
    case 'sqlite':   return '?'
  }
}

// Quote identifier — dialect-aware
function qi(name: string, dialect: SqlDialect): string {
  if (dialect === 'mysql') return `\`${name.replace(/`/g, '``')}\``
  return `"${name.replace(/"/g, '""')}"`
}

function buildSelectCols(columns: ColumnMap[], dialect: SqlDialect): string {
  if (columns.length === 0) return '*'
  return columns.map(c => `${qi(c.field, dialect)} AS ${qi(c.label, dialect)}`).join(', ')
}

function mssqlTop(n: number, dialect: SqlDialect): string {
  return dialect === 'mssql' ? `TOP ${n} ` : ''
}

function buildWhereExpr(f: Filter, ph: string, _dialect: SqlDialect): string {
  switch (f.operator) {
    case '==': return `${f.field} = ${ph}`
    case '!=': return `${f.field} != ${ph}`
    case '>':  return `${f.field} > ${ph}`
    case '<':  return `${f.field} < ${ph}`
    case '>=': return `${f.field} >= ${ph}`
    case '<=': return `${f.field} <= ${ph}`
    default: throw new Error(`unhandled where operator: ${f.operator}`)
  }
}

function buildAggExpr(op: AggregateOp, dialect: SqlDialect): string {
  const label = qi(op.label, dialect)
  switch (op.func) {
    case 'count': return `COUNT(*) AS ${label}`
    case 'sum':   return `SUM(${qi(op.field!, dialect)}) AS ${label}`
    case 'avg':   return `AVG(${qi(op.field!, dialect)}) AS ${label}`
    case 'min':   return `MIN(${qi(op.field!, dialect)}) AS ${label}`
    case 'max':   return `MAX(${qi(op.field!, dialect)}) AS ${label}`
    default: throw new Error(`unhandled aggregate function: ${op.func}`)
  }
}

export function normalizeRow(doc: Record<string, unknown>): import('../query.js').Row {
  const row: import('../query.js').Row = {}
  for (const [key, val] of Object.entries(doc)) {
    if (val instanceof Date) row[key] = val.toISOString()
    else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) row[key] = val
    else if (val !== undefined) row[key] = String(val)
  }
  return row
}
