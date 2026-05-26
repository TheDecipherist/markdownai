import type { DbAdapter, QueryPlan, Row, Filter, ColumnMap, SortTerm, AggregateOp } from '../query.js'
import { MongoClient, type Db, ObjectId } from 'mongodb'

export class MongoDbAdapter implements DbAdapter {
  private client: MongoClient | null = null
  private db: Db | null = null

  async connect(uri: string): Promise<void> {
    this.client = new MongoClient(uri)
    await this.client.connect()
    const dbName = new URL(uri).pathname.slice(1) || undefined
    this.db = this.client.db(dbName)
  }

  async execute(plan: QueryPlan): Promise<Row[]> {
    if (!this.db) throw new Error('@db mongodb: not connected — call connect() first')
    switch (plan.operation) {
      case 'find': return this.executeFind(plan)
      case 'one': return this.executeOne(plan)
      case 'count': return this.executeCount(plan)
      case 'aggregate': return this.executeAggregate(plan)
      default: throw new Error(`@db mongodb: unhandled operation: ${plan.operation}`)
    }
  }

  async executeRaw(query: string): Promise<Row[]> {
    if (!this.db) throw new Error('@db mongodb: not connected')
    // Format: "<collection>:<pipeline_json>"
    const colonIdx = query.indexOf(':')
    if (colonIdx === -1) {
      throw new Error('@db mongodb: raw= requires format "<collection>:<pipeline_json_array>"')
    }
    const collection = query.slice(0, colonIdx).trim()
    if (!/^[a-zA-Z0-9_.-]+$/.test(collection)) {
      throw new Error(`@db mongodb: invalid collection name: "${collection}"`)
    }
    let pipeline: Record<string, unknown>[]
    try {
      pipeline = JSON.parse(query.slice(colonIdx + 1).trim()) as Record<string, unknown>[]
    } catch (err) {
      throw new Error(`@db mongodb: invalid pipeline JSON: ${String(err)}`)
    }
    const docs = await this.db.collection(collection).aggregate(pipeline).toArray()
    return docs.map(doc => normalizeRow(doc as Record<string, unknown>))
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.db().command({ ping: 1 })
      return true
    } catch {
      return false
    }
  }

  private async executeFind(plan: QueryPlan): Promise<Row[]> {
    const coll = this.db!.collection(plan.collection)
    const filter = buildFilter(plan)
    const projection = buildProjection(plan.columns)
    const sort = buildSort(plan.sort)
    let cursor = coll.find(filter, projection ? { projection } : {}).sort(sort)
    if (plan.limit !== null) cursor = cursor.limit(plan.limit)
    const docs = await cursor.toArray()
    return docs.map(doc => normalizeRow(doc as Record<string, unknown>))
  }

  private async executeOne(plan: QueryPlan): Promise<Row[]> {
    const coll = this.db!.collection(plan.collection)
    const doc = await coll.findOne(buildFilter(plan))
    if (doc === null) return []
    return [normalizeRow(doc as Record<string, unknown>)]
  }

  private async executeCount(plan: QueryPlan): Promise<Row[]> {
    const coll = this.db!.collection(plan.collection)
    const count = await coll.countDocuments(buildFilter(plan))
    return [{ count }]
  }

  private async executeAggregate(plan: QueryPlan): Promise<Row[]> {
    const coll = this.db!.collection(plan.collection)
    const groupStage: Record<string, unknown> = { _id: `$${plan.group}` }
    for (const op of plan.aggregations) groupStage[op.label] = buildAccumulator(op)
    const pipeline: Record<string, unknown>[] = []
    if (plan.where.length > 0) pipeline.push({ $match: buildFilter(plan) })
    pipeline.push({ $group: groupStage })
    const docs = await coll.aggregate(pipeline).toArray()
    return docs.map(doc => normalizeAggregateRow(doc as Record<string, unknown>, plan.group!))
  }
}

function buildFilter(plan: QueryPlan): Record<string, unknown> {
  if (plan.where.length === 0) return {}
  const hasOr = plan._hasOrFilters === true
  const conditions = plan.where.map(buildCondition)
  if (hasOr) return { $or: conditions }
  return Object.assign({}, ...conditions) as Record<string, unknown>
}

function buildCondition(f: Filter): Record<string, unknown> {
  switch (f.operator) {
    case '==': return { [f.field]: f.value }
    case '!=': return { [f.field]: { $ne: f.value } }
    case '>':  return { [f.field]: { $gt: f.value } }
    case '<':  return { [f.field]: { $lt: f.value } }
    case '>=': return { [f.field]: { $gte: f.value } }
    case '<=': return { [f.field]: { $lte: f.value } }
    default: throw new Error(`@db mongodb: unhandled filter operator: ${f.operator}`)
  }
}

function buildProjection(columns: ColumnMap[]): Record<string, 0 | 1> | null {
  if (columns.length === 0) return null
  const proj: Record<string, 0 | 1> = { _id: 0 }
  for (const col of columns) proj[col.field] = 1
  return proj
}

function buildSort(sort: SortTerm[]): Record<string, 1 | -1> {
  const obj: Record<string, 1 | -1> = {}
  for (const s of sort) obj[s.field] = s.dir === 'asc' ? 1 : -1
  return obj
}

function buildAccumulator(op: AggregateOp): Record<string, unknown> {
  switch (op.func) {
    case 'count': return { $sum: 1 }
    case 'sum':   return { $sum: `$${op.field}` }
    case 'avg':   return { $avg: `$${op.field}` }
    case 'min':   return { $min: `$${op.field}` }
    case 'max':   return { $max: `$${op.field}` }
    default: throw new Error(`@db mongodb: unhandled accumulator function: ${op.func}`)
  }
}

// Preserve the document's tree shape (arrays + nested objects) so consumers
// can dot-access nested fields and iterate arrays via @foreach. ObjectIds
// and Dates are normalized to strings recursively.
function normalizeValue(val: unknown): import('../query.js').RowValue {
  if (val === null || val === undefined) return null
  if (val instanceof ObjectId) return val.toString()
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val
  if (Array.isArray(val)) return val.map(v => normalizeValue(v))
  if (typeof val === 'object') {
    const out: Record<string, import('../query.js').RowValue> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const nv = normalizeValue(v)
      if (nv !== undefined) out[k] = nv
    }
    return out
  }
  return String(val)
}

function normalizeRow(doc: Record<string, unknown>): Row {
  const row: Row = {}
  for (const [key, val] of Object.entries(doc)) {
    if (val === undefined) continue
    row[key] = normalizeValue(val)
  }
  return row
}

function normalizeAggregateRow(doc: Record<string, unknown>, groupField: string): Row {
  const row: Row = {}
  for (const [key, val] of Object.entries(doc)) {
    const outKey = key === '_id' ? groupField : key
    if (val instanceof ObjectId) row[outKey] = val.toString()
    else if (val instanceof Date) row[outKey] = val.toISOString()
    else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) row[outKey] = val
    else if (val !== undefined) row[outKey] = String(val)
  }
  return row
}
