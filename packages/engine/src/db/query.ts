// QueryPlan types — canonical definitions imported by all adapters
export type Operation = 'find' | 'one' | 'count' | 'aggregate'

export interface Filter {
  field: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  value: string | number | boolean | null
}

export interface SortTerm {
  field: string
  dir: 'asc' | 'desc'
}

export interface ColumnMap {
  field: string   // source field name (supports dot-notation)
  label: string   // display label
}

export interface AggregateOp {
  func: 'count' | 'sum' | 'avg' | 'min' | 'max'
  field: string | null   // null for count
  label: string          // output column name e.g. "sum_amount"
}

export interface QueryPlan {
  operation: Operation
  collection: string
  where: Filter[]
  sort: SortTerm[]
  limit: number | null
  columns: ColumnMap[]
  group: string | null
  aggregations: AggregateOp[]
  _hasOrFilters?: boolean
}

export type Row = Record<string, string | number | boolean | null>

export interface DbAdapter {
  connect(uri: string): Promise<void>
  disconnect(): Promise<void>
  ping(): Promise<boolean>
  execute(plan: QueryPlan): Promise<Row[]>
  executeRaw(query: string): Promise<Row[]>
}

// Parsed result — discriminated union: structured plan or raw pass-through
export type ParsedQuery =
  | { kind: 'plan'; plan: QueryPlan }
  | { kind: 'raw'; query: string }

// ---- Parse error

export interface DbParseContext {
  file?: string
  line?: number
}

export class DbParseError extends Error {
  readonly context: DbParseContext
  constructor(message: string, context: DbParseContext = {}) {
    super(message)
    this.name = 'DbParseError'
    this.context = context
  }

  format(): string {
    const { file, line } = this.context
    if (!file && line === undefined) return this.message
    const parts: string[] = [this.message]
    if (file) parts.push(`  File:   ${file}`)
    if (line !== undefined) parts.push(`  Line:   ${line}`)
    return parts.join('\n')
  }
}

// ---- Type inference for filter values

function inferValue(raw: string, env: Record<string, string>): string | number | boolean | null {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  // env reference
  if (trimmed.startsWith('env.')) {
    const key = trimmed.slice(4)
    return env[key] ?? ''
  }
  // number
  const num = Number(trimmed)
  if (trimmed !== '' && !isNaN(num)) return num
  // strip surrounding quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

// ---- Where clause parser

type LogicOp = 'and' | 'or'

interface FilterToken {
  filter: Filter
  logic: LogicOp  // logic to combine with NEXT filter ('and' for last)
}

const OPERATORS: Array<['>=', '>='] | ['<=', '<='] | ['!=', '!='] | ['==', '=='] | ['>', '>'] | ['<', '<']> = [
  ['>=', '>='], ['<=', '<='], ['!=', '!='], ['==', '=='], ['>', '>'], ['<', '<'],
]

function parseOneFilter(expr: string, env: Record<string, string>): Filter {
  const trimmed = expr.trim()
  for (const [opStr, op] of OPERATORS) {
    const idx = trimmed.indexOf(opStr)
    if (idx === -1) continue
    const field = trimmed.slice(0, idx).trim()
    const rawValue = trimmed.slice(idx + opStr.length)
    if (!field) continue
    return { field, operator: op, value: inferValue(rawValue, env) }
  }
  throw new DbParseError(`Invalid filter expression: "${trimmed}"`)
}

// Splits a where string respecting parentheses
function splitOnLogic(where: string): Array<{ expr: string; logic: LogicOp }> {
  const tokens: Array<{ expr: string; logic: LogicOp }> = []
  let depth = 0
  let cur = ''
  let i = 0
  while (i < where.length) {
    const ch = where[i]!
    if (ch === '(') { depth++; cur += ch; i++; continue }
    if (ch === ')') { depth--; cur += ch; i++; continue }
    if (depth === 0) {
      if (where.slice(i, i + 4) === ' && ') {
        tokens.push({ expr: cur.trim(), logic: 'and' })
        cur = ''
        i += 4
        continue
      }
      if (where.slice(i, i + 4) === ' || ') {
        tokens.push({ expr: cur.trim(), logic: 'or' })
        cur = ''
        i += 4
        continue
      }
    }
    cur += ch
    i++
  }
  if (cur.trim()) tokens.push({ expr: cur.trim(), logic: 'and' })
  return tokens
}

function parseFilterToken(expr: string, env: Record<string, string>): Filter {
  const trimmed = expr.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return parseOneFilter(trimmed.slice(1, -1).trim(), env)
  }
  return parseOneFilter(trimmed, env)
}

export function parseFilters(whereStr: string, env: Record<string, string>): { filters: Filter[]; hasOr: boolean } {
  if (!whereStr.trim()) return { filters: [], hasOr: false }
  const parts = splitOnLogic(whereStr)
  const filters: Filter[] = []
  let hasOr = false
  for (const { expr, logic } of parts) {
    filters.push(parseFilterToken(expr, env))
    if (logic === 'or') hasOr = true
  }
  return { filters, hasOr }
}

// ---- Sort parser

function parseSortTerms(sortStr: string): SortTerm[] {
  return sortStr.split(',').map(part => {
    const trimmed = part.trim()
    const colonIdx = trimmed.lastIndexOf(':')
    if (colonIdx === -1) return { field: trimmed, dir: 'asc' as const }
    const field = trimmed.slice(0, colonIdx).trim()
    const dirRaw = trimmed.slice(colonIdx + 1).trim()
    if (dirRaw !== 'asc' && dirRaw !== 'desc') {
      throw new DbParseError(`Invalid sort direction "${dirRaw}" on field "${field}" — must be "asc" or "desc"`)
    }
    return { field, dir: dirRaw }
  })
}

// ---- Column parser

function parseColumns(columnsStr: string): ColumnMap[] {
  return columnsStr.split(',').map(part => {
    const trimmed = part.trim()
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) return { field: trimmed, label: trimmed }
    return {
      field: trimmed.slice(0, colonIdx).trim(),
      label: trimmed.slice(colonIdx + 1).trim(),
    }
  })
}

// ---- Aggregate ops parser

function parseAggregateOps(args: Record<string, string>, hasAggregate: boolean): AggregateOp[] {
  if (!hasAggregate) return []
  const ops: AggregateOp[] = []
  if (args['count'] === 'true') ops.push({ func: 'count', field: null, label: 'count' })
  for (const func of ['sum', 'avg', 'min', 'max'] as const) {
    const field = args[func]
    if (field) ops.push({ func, field, label: `${func}_${field}` })
  }
  return ops
}

// ---- Main parser

const OPERATIONS = ['find', 'one', 'count', 'aggregate', 'raw'] as const
type AnyOperation = typeof OPERATIONS[number]

export function parseQuery(
  args: Record<string, string>,
  env: Record<string, string>,
  context: DbParseContext = {},
): ParsedQuery {
  try {
    return parseQueryInternal(args, env)
  } catch (err) {
    if (err instanceof DbParseError) throw new DbParseError(err.message, context)
    throw err
  }
}

function parseQueryInternal(args: Record<string, string>, env: Record<string, string>): ParsedQuery {
  // Detect which operation is present
  const presentOps = OPERATIONS.filter(op => args[op] !== undefined)
  // 'count=true' inside aggregate= is NOT a top-level count op
  const isAggregateCount = args['aggregate'] !== undefined && args['count'] === 'true'
  const filteredOps = isAggregateCount
    ? presentOps.filter(op => op !== 'count')
    : presentOps

  if (filteredOps.length === 0) {
    throw new DbParseError('@db: no operation specified — use find=, one=, count=, aggregate=, or raw=')
  }
  if (filteredOps.length > 1) {
    throw new DbParseError(
      `@db: multiple operations on one directive (${filteredOps.join(', ')}) — only one is allowed`
    )
  }

  const op = filteredOps[0]! as AnyOperation

  // raw= bypass: no QueryPlan
  if (op === 'raw') {
    const rawQuery = args['raw']!
    return { kind: 'raw', query: rawQuery }
  }

  const collection = args[op]!

  // where clause
  const { filters, hasOr } = args['where']
    ? parseFilters(args['where'], env)
    : { filters: [], hasOr: false }

  // sort
  const sort = args['sort'] ? parseSortTerms(args['sort']) : []

  // limit
  const limitRaw = args['limit']
  const limit = limitRaw !== undefined ? parseInt(limitRaw, 10) : null

  // columns
  const columns = args['columns'] ? parseColumns(args['columns']) : []

  // group (aggregate only)
  const group = args['group'] ?? null

  // aggregations
  const aggregations = parseAggregateOps(args, op === 'aggregate')

  // Validation rules
  if ((op === 'find' || op === 'one') && args['sort']) {
    // valid — sort is allowed on find and one
  }
  if (op === 'count' && args['sort']) {
    throw new DbParseError('@db: sort= is not valid with count= operation')
  }
  if (op === 'count' && args['columns']) {
    throw new DbParseError('@db: columns= is not valid with count= operation')
  }
  if (op === 'aggregate' && !group) {
    throw new DbParseError('@db: aggregate= requires group= field')
  }
  if (op === 'aggregate' && aggregations.length === 0) {
    throw new DbParseError('@db: aggregate= requires at least one aggregation function (count=true, sum=, avg=, min=, or max=)')
  }

  const plan: QueryPlan = {
    operation: op as Operation,
    collection,
    where: filters,
    sort,
    limit,
    columns,
    group,
    aggregations,
  }

  // Attach OR flag as non-enumerable so adapters can detect it without type violation
  if (hasOr) {
    Object.defineProperty(plan, '_hasOrFilters', { value: true, enumerable: false })
  }

  return { kind: 'plan', plan }
}
