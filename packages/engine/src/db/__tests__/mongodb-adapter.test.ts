import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { QueryPlan } from '../query.js'

// ---- Mock mongodb driver ----

const mockToArray = vi.fn().mockResolvedValue([])
const mockCursor = {
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: mockToArray,
}
const mockAggToArray = vi.fn().mockResolvedValue([])
const mockCollection = {
  find: vi.fn().mockReturnValue(mockCursor),
  findOne: vi.fn().mockResolvedValue(null),
  countDocuments: vi.fn().mockResolvedValue(0),
  aggregate: vi.fn().mockReturnValue({ toArray: mockAggToArray }),
}
const mockDbCommand = vi.fn().mockResolvedValue({})
const mockDb = {
  collection: vi.fn().mockReturnValue(mockCollection),
  command: mockDbCommand,
}
const mockConnect = vi.fn().mockResolvedValue(undefined)
const mockClose = vi.fn().mockResolvedValue(undefined)
const mockDbFn = vi.fn().mockReturnValue(mockDb)
const mockClientInstance = {
  connect: mockConnect,
  close: mockClose,
  db: mockDbFn,
}
const MockMongoClient = vi.fn().mockImplementation(() => mockClientInstance)

class MockObjectId {
  constructor(private id = 'abc123') {}
  toString() { return this.id }
}

vi.mock('mongodb', () => ({
  MongoClient: MockMongoClient,
  ObjectId: MockObjectId,
}))

const { MongoDbAdapter } = await import('../adapters/mongodb.js')

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

async function connectedAdapter() {
  const a = new MongoDbAdapter()
  await a.connect('mongodb://localhost/testdb')
  vi.clearAllMocks()  // clear connect() calls so tests start clean
  return a
}

describe('MongoDbAdapter — connection', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('connect() calls MongoClient.connect()', async () => {
    const a = new MongoDbAdapter()
    await a.connect('mongodb://localhost/testdb')
    expect(mockConnect).toHaveBeenCalledOnce()
  })

  it('ping() returns true when connected and server responds', async () => {
    const a = await connectedAdapter()
    const result = await a.ping()
    expect(result).toBe(true)
    expect(mockDbCommand).toHaveBeenCalledWith({ ping: 1 })
  })

  it('ping() returns false (not throws) when not connected', async () => {
    const a = new MongoDbAdapter()
    const result = await a.ping()
    expect(result).toBe(false)
  })

  it('disconnect() closes the client', async () => {
    const a = await connectedAdapter()
    await a.disconnect()
    expect(mockClose).toHaveBeenCalledOnce()
  })
})

describe('MongoDbAdapter — find operation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('find with no filters calls collection.find({})', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan())
    expect(mockCollection.find).toHaveBeenCalledWith({}, {})
  })

  it('find with AND filters passes correct filter object', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      where: [
        { field: 'active', operator: '==', value: true },
        { field: 'role', operator: '==', value: 'admin' },
      ],
    }))
    expect(mockCollection.find).toHaveBeenCalledWith(
      { active: true, role: 'admin' },
      {},
    )
  })

  it('find with OR filters uses $or', async () => {
    const a = await connectedAdapter()
    const plan = makePlan({
      where: [
        { field: 'status', operator: '==', value: 'pending' },
        { field: 'status', operator: '==', value: 'processing' },
      ],
    })
    Object.defineProperty(plan, '_hasOrFilters', { value: true, enumerable: false })
    await a.execute(plan)
    expect(mockCollection.find).toHaveBeenCalledWith(
      { $or: [{ status: 'pending' }, { status: 'processing' }] },
      {},
    )
  })

  it('find with sort builds sort document', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({ sort: [{ field: 'name', dir: 'asc' }] }))
    expect(mockCursor.sort).toHaveBeenCalledWith({ name: 1 })
  })

  it('find with limit calls .limit(N)', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({ limit: 10 }))
    expect(mockCursor.limit).toHaveBeenCalledWith(10)
  })

  it('find with columns builds projection (excludes _id)', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'email', label: 'Email' },
      ],
    }))
    expect(mockCollection.find).toHaveBeenCalledWith(
      {},
      { projection: { _id: 0, name: 1, email: 1 } },
    )
  })

  it('find normalizes ObjectId values to strings', async () => {
    mockToArray.mockResolvedValueOnce([{ _id: new MockObjectId('507f1f77bcf86cd799439011'), name: 'Alice' }])
    const a = await connectedAdapter()
    const rows = await a.execute(makePlan())
    expect(rows[0]!._id).toBe('507f1f77bcf86cd799439011')
    expect(rows[0]!.name).toBe('Alice')
  })

  it('find normalizes Date values to ISO strings', async () => {
    const d = new Date('2024-01-15T10:00:00.000Z')
    mockToArray.mockResolvedValueOnce([{ createdAt: d, name: 'Bob' }])
    const a = await connectedAdapter()
    const rows = await a.execute(makePlan())
    expect(rows[0]!.createdAt).toBe('2024-01-15T10:00:00.000Z')
  })
})

describe('MongoDbAdapter — count operation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('count calls countDocuments() with filter', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      operation: 'count',
      where: [{ field: 'active', operator: '==', value: true }],
    }))
    expect(mockCollection.countDocuments).toHaveBeenCalledWith({ active: true })
  })

  it('count returns [{ count: N }]', async () => {
    mockCollection.countDocuments.mockResolvedValueOnce(42)
    const a = await connectedAdapter()
    const rows = await a.execute(makePlan({ operation: 'count' }))
    expect(rows).toEqual([{ count: 42 }])
  })
})

describe('MongoDbAdapter — one operation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('one calls findOne() with filter', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      operation: 'one',
      where: [{ field: 'email', operator: '==', value: 'user@example.com' }],
    }))
    expect(mockCollection.findOne).toHaveBeenCalledWith({ email: 'user@example.com' })
  })

  it('one returns empty array when no document found', async () => {
    mockCollection.findOne.mockResolvedValueOnce(null)
    const a = await connectedAdapter()
    const rows = await a.execute(makePlan({ operation: 'one' }))
    expect(rows).toEqual([])
  })

  it('one returns single-element array when document found', async () => {
    mockCollection.findOne.mockResolvedValueOnce({ name: 'Alice', active: true })
    const a = await connectedAdapter()
    const rows = await a.execute(makePlan({ operation: 'one' }))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('Alice')
  })
})

describe('MongoDbAdapter — aggregate operation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('aggregate builds $group stage with _id and accumulators', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      operation: 'aggregate',
      collection: 'orders',
      group: 'status',
      aggregations: [{ func: 'count', field: null, label: 'count' }],
    }))
    const [[pipeline]] = mockCollection.aggregate.mock.calls
    const groupStage = (pipeline as Record<string, unknown>[])[0]!
    expect(groupStage).toHaveProperty('$group')
    const group = (groupStage as { $group: Record<string, unknown> }).$group
    expect(group._id).toBe('$status')
    expect(group.count).toEqual({ $sum: 1 })
  })

  it('aggregate with count=true uses $sum: 1', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      operation: 'aggregate',
      group: 'type',
      aggregations: [{ func: 'count', field: null, label: 'count' }],
    }))
    const [[pipeline]] = mockCollection.aggregate.mock.calls
    const groupStage = (pipeline as { $group: Record<string, unknown> }[])[0]!
    expect(groupStage.$group.count).toEqual({ $sum: 1 })
  })

  it('aggregate with sum uses $sum: "$field"', async () => {
    const a = await connectedAdapter()
    await a.execute(makePlan({
      operation: 'aggregate',
      group: 'category',
      aggregations: [{ func: 'sum', field: 'amount', label: 'sum_amount' }],
    }))
    const [[pipeline]] = mockCollection.aggregate.mock.calls
    const groupStage = (pipeline as { $group: Record<string, unknown> }[])[0]!
    expect(groupStage.$group.sum_amount).toEqual({ $sum: '$amount' })
  })
})
