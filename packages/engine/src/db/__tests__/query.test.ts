import { describe, it, expect } from 'vitest'
import { parseQuery, parseFilters, DbParseError } from '../query.js'

describe('parseQuery — operation detection', () => {
  it('parses find= into a plan with operation:find', () => {
    const result = parseQuery({ find: 'users' }, {})
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.operation).toBe('find')
    expect(result.plan.collection).toBe('users')
  })

  it('parses one= into a plan with operation:one', () => {
    const result = parseQuery({ one: 'users' }, {})
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.operation).toBe('one')
  })

  it('parses count= into a plan with operation:count', () => {
    const result = parseQuery({ count: 'orders' }, {})
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.operation).toBe('count')
    expect(result.plan.aggregations).toEqual([])
    expect(result.plan.group).toBeNull()
  })

  it('parses raw= as raw bypass (no QueryPlan)', () => {
    const result = parseQuery({ raw: 'SELECT 1' }, {})
    expect(result.kind).toBe('raw')
    if (result.kind !== 'raw') return
    expect(result.query).toBe('SELECT 1')
  })

  it('throws FATAL when no operation present', () => {
    expect(() => parseQuery({ using: 'primary' }, {})).toThrow(DbParseError)
  })

  it('throws FATAL when two operations present', () => {
    expect(() => parseQuery({ find: 'users', count: 'users' }, {})).toThrow(DbParseError)
  })

  it('count=true inside aggregate= is parsed as AggregateOp, not top-level count', () => {
    const result = parseQuery({ aggregate: 'orders', group: 'status', count: 'true' }, {})
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.operation).toBe('aggregate')
    expect(result.plan.aggregations).toEqual([{ func: 'count', field: null, label: 'count' }])
  })
})

describe('parseQuery — full plan: find with options', () => {
  it('parses find with where, sort, limit, columns', () => {
    const result = parseQuery(
      { find: 'users', where: 'active==true', sort: 'name:asc', limit: '10', columns: 'name:Name,email:Email' },
      {},
    )
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    const { plan } = result
    expect(plan.operation).toBe('find')
    expect(plan.collection).toBe('users')
    expect(plan.where).toEqual([{ field: 'active', operator: '==', value: true }])
    expect(plan.sort).toEqual([{ field: 'name', dir: 'asc' }])
    expect(plan.limit).toBe(10)
    expect(plan.columns).toEqual([
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email' },
    ])
  })
})

describe('parseFilters — type inference', () => {
  it('infers boolean true', () => {
    const { filters } = parseFilters('active==true', {})
    expect(filters[0]?.value).toBe(true)
    expect(typeof filters[0]?.value).toBe('boolean')
  })

  it('infers boolean false', () => {
    const { filters } = parseFilters('active==false', {})
    expect(filters[0]?.value).toBe(false)
  })

  it('infers null', () => {
    const { filters } = parseFilters('deletedAt==null', {})
    expect(filters[0]?.value).toBeNull()
  })

  it('infers number', () => {
    const { filters } = parseFilters('amount>100', {})
    expect(filters[0]?.value).toBe(100)
    expect(typeof filters[0]?.value).toBe('number')
  })

  it('infers string for non-numeric text', () => {
    const { filters } = parseFilters('status==pending', {})
    expect(filters[0]?.value).toBe('pending')
    expect(typeof filters[0]?.value).toBe('string')
  })

  it('resolves env.VAR tokens from env', () => {
    const { filters } = parseFilters('id==env.USER_ID', { USER_ID: 'abc123' })
    expect(filters[0]?.value).toBe('abc123')
  })

  it('env.VAR resolves to empty string when not set', () => {
    const { filters } = parseFilters('id==env.MISSING', {})
    expect(filters[0]?.value).toBe('')
  })
})

describe('parseFilters — operators', () => {
  it('parses equality ==', () => {
    const { filters } = parseFilters('status==pending', {})
    expect(filters[0]?.operator).toBe('==')
  })

  it('parses inequality !=', () => {
    const { filters } = parseFilters('status!=deleted', {})
    expect(filters[0]?.operator).toBe('!=')
  })

  it('parses greater than >', () => {
    const { filters } = parseFilters('amount>100', {})
    expect(filters[0]?.operator).toBe('>')
  })

  it('parses >= operator', () => {
    const { filters } = parseFilters('score>=90', {})
    expect(filters[0]?.operator).toBe('>=')
  })

  it('parses < operator', () => {
    const { filters } = parseFilters('price<50', {})
    expect(filters[0]?.operator).toBe('<')
  })

  it('parses <= operator', () => {
    const { filters } = parseFilters('stock<=0', {})
    expect(filters[0]?.operator).toBe('<=')
  })
})

describe('parseFilters — compound expressions', () => {
  it('AND chain produces two Filter objects', () => {
    const { filters, hasOr } = parseFilters('active==true && role==admin', {})
    expect(filters).toHaveLength(2)
    expect(filters[0]?.field).toBe('active')
    expect(filters[1]?.field).toBe('role')
    expect(hasOr).toBe(false)
  })

  it('OR chain produces two Filter objects with OR semantics', () => {
    const { filters, hasOr } = parseFilters('status==pending || status==processing', {})
    expect(filters).toHaveLength(2)
    expect(hasOr).toBe(true)
  })

  it('multi-field AND chain produces correct filters', () => {
    const { filters } = parseFilters('amount>100 && tier==premium && active==true', {})
    expect(filters).toHaveLength(3)
    expect(filters[0]?.field).toBe('amount')
    expect(filters[1]?.field).toBe('tier')
    expect(filters[2]?.field).toBe('active')
  })
})

describe('parseQuery — sort', () => {
  it('parses single sort field', () => {
    const result = parseQuery({ find: 'users', sort: 'createdAt:desc' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.sort).toEqual([{ field: 'createdAt', dir: 'desc' }])
  })

  it('parses multi-field sort', () => {
    const result = parseQuery({ find: 'orders', sort: 'amount:desc,name:asc' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.sort).toEqual([
      { field: 'amount', dir: 'desc' },
      { field: 'name', dir: 'asc' },
    ])
  })

  it('throws on invalid sort direction', () => {
    expect(() => parseQuery({ find: 'users', sort: 'name:sideways' }, {})).toThrow(DbParseError)
  })

  it('throws when sort= used with count= operation', () => {
    expect(() => parseQuery({ count: 'orders', sort: 'name:asc' }, {})).toThrow(DbParseError)
  })
})

describe('parseQuery — columns', () => {
  it('parses columns with labels', () => {
    const result = parseQuery({ find: 'users', columns: 'name:Name,email:Email,role:Role' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.columns).toEqual([
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email' },
      { field: 'role', label: 'Role' },
    ])
  })

  it('preserves dot-notation field paths', () => {
    const result = parseQuery({ find: 'users', columns: 'profile.firstName:First Name,email:Email' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.columns[0]?.field).toBe('profile.firstName')
    expect(result.plan.columns[0]?.label).toBe('First Name')
  })

  it('throws when columns= used with count= operation', () => {
    expect(() => parseQuery({ count: 'orders', columns: 'name:Name' }, {})).toThrow(DbParseError)
  })

  it('empty plan.columns when columns= not specified', () => {
    const result = parseQuery({ find: 'users' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.columns).toEqual([])
  })
})

describe('parseQuery — aggregate', () => {
  it('count=true inside aggregate produces AggregateOp', () => {
    const result = parseQuery({ aggregate: 'orders', group: 'status', count: 'true' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.aggregations).toEqual([{ func: 'count', field: null, label: 'count' }])
  })

  it('sum= produces AggregateOp with label sum_<field>', () => {
    const result = parseQuery({ aggregate: 'orders', group: 'region', sum: 'amount' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.aggregations).toEqual([{ func: 'sum', field: 'amount', label: 'sum_amount' }])
  })

  it('multiple aggregation functions produce multiple AggregateOps', () => {
    const result = parseQuery({ aggregate: 'orders', group: 'status', count: 'true', sum: 'amount', avg: 'amount' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.aggregations).toHaveLength(3)
  })

  it('throws when aggregate= used without group=', () => {
    expect(() => parseQuery({ aggregate: 'orders', count: 'true' }, {})).toThrow(DbParseError)
  })

  it('throws when aggregate= has no aggregation function', () => {
    expect(() => parseQuery({ aggregate: 'orders', group: 'status' }, {})).toThrow(DbParseError)
  })
})

describe('parseQuery — QueryPlan defaults', () => {
  it('where is empty array when no where= option', () => {
    const result = parseQuery({ find: 'users' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.where).toEqual([])
  })

  it('sort is empty array when no sort= option', () => {
    const result = parseQuery({ find: 'users' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.sort).toEqual([])
  })

  it('limit is null when no limit= option', () => {
    const result = parseQuery({ find: 'users' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.limit).toBeNull()
  })

  it('group is null for non-aggregate operations', () => {
    const result = parseQuery({ find: 'users' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.group).toBeNull()
  })

  it('aggregations is empty array for non-aggregate operations', () => {
    const result = parseQuery({ find: 'users' }, {})
    if (result.kind !== 'plan') throw new Error()
    expect(result.plan.aggregations).toEqual([])
  })
})
