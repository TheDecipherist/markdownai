---
id: 70-db-mongodb-adapter
title: DB — MongoDB Adapter
type: COMPONENT
initiative: markdownai-db
wave: markdownai-db-wave-2
wave_status: planned
edition: Both
depends_on: [69-db-adapter-interface]
source_files:
  - packages/engine/src/db/adapters/mongodb.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: draft
phase: documentation
mdd_version: 1
tags: [db, mongodb, adapter, native-driver, find, findOne, countDocuments, aggregate]
path: DB/Adapters
known_issues: []
---

# 70 — DB — MongoDB Adapter

## What to Build

`packages/engine/src/db/adapters/mongodb.ts` - a class implementing `DbAdapter` that translates QueryPlan objects to MongoDB native driver calls using the `mongodb` npm package (no Mongoose, no ODM layer).

This is the MongoDB-specific implementation of the DbAdapter interface defined in `69-db-adapter-interface`.

## Architecture

The adapter imports `MongoClient` from the `mongodb` package. It implements all five `DbAdapter` methods. It handles connection pooling internally via `MongoClient`. The executor never calls MongoDB driver methods directly.

## Implementation Notes

Use the native `mongodb` driver, not Mongoose. This is a hard requirement from the project rules.

Boolean values in filters come through the QueryPlan as typed `true`/`false` booleans. Pass them directly to the driver - MongoDB natively supports boolean values. No coercion needed.

For the `columns` option (ColumnMap[]), build a MongoDB projection object: `{ name: 1, email: 1, _id: 0 }`. Exclude `_id` by default when any projection is specified (standard MongoDB projection behavior).

For `sort`, build a MongoDB sort document: `{ name: 1 }` for `asc`, `{ name: -1 }` for `desc`.

For OR-chained filters in the where clause, use `$or`. For AND-chained, pass as a plain filter object (MongoDB ANDs by default).

## Data Model

**QueryPlan to MongoDB translation:**

| QueryPlan field | MongoDB driver call |
|---|---|
| `operation: "find"` | `db.collection.find(filter, projection).sort(sort).limit(limit)` |
| `operation: "one"` | `db.collection.findOne(filter)` |
| `operation: "count"` | `db.collection.countDocuments(filter)` |
| `operation: "aggregate"` | `db.collection.aggregate(pipeline)` |
| `where: Filter[]` | filter document `{ field: value, ... }` or `{ $or: [...] }` |
| `sort: SortTerm[]` | `{ field: 1 }` (asc) or `{ field: -1 }` (desc) |
| `columns: ColumnMap[]` | projection `{ field: 1, ..., _id: 0 }` |
| `limit: number` | `.limit(N)` |
| `group: string` | `$group._id: "$field"` |
| `aggregations: AggregateOp[]` | accumulator fields in `$group` |

**Aggregate pipeline mapping:**

```javascript
// QueryPlan: aggregate="orders" group="status" count=true sum="amount"
db.orders.aggregate([
  { $group: {
    _id: "$status",
    count: { $sum: 1 },
    sum_amount: { $sum: "$amount" }
  }}
])
```

**AggregateOp to MongoDB accumulator:**

| func | MongoDB accumulator |
|---|---|
| `count` | `{ $sum: 1 }` |
| `sum` | `{ $sum: "$field" }` |
| `avg` | `{ $avg: "$field" }` |
| `min` | `{ $min: "$field" }` |
| `max` | `{ $max: "$field" }` |

## API / Interface

```typescript
// packages/engine/src/db/adapters/mongodb.ts
import type { DbAdapter, QueryPlan, Row } from '../query.js'
import { MongoClient, type Db } from 'mongodb'

export class MongoDbAdapter implements DbAdapter {
  connect(uri: string): Promise<void>
  execute(plan: QueryPlan): Promise<Row[]>
  executeRaw(query: string): Promise<Row[]>
  disconnect(): Promise<void>
  ping(): Promise<boolean>
}
```

## Business Rules

1. Uses `mongodb` native driver only. No Mongoose, no ODM.
2. Boolean filter values (`true`/`false`) are passed directly to the driver - no coercion.
3. When `columns` is specified, build a projection object and always exclude `_id` (append `_id: 0`).
4. When `columns` is empty, return all fields (no projection).
5. OR-chained filters (`||`) translate to MongoDB `$or`. AND-chained filters translate to a plain filter object.
6. `countDocuments()` is used for the `count` operation (not `count()` which is deprecated).
7. `findOne()` returns a single document or null. On null, return an empty array.
8. The `one` operation uses `findOne()`. The executor handles the case where no rows are returned (empty output, no error).
9. The aggregate pipeline uses `$group` for grouping. Each AggregateOp becomes an accumulator in `$group`.
10. `executeRaw()` for MongoDB accepts an aggregation pipeline string or a find-style query string. Behavior is driver-specific - document what formats are supported.
11. All returned Row values must be serializable: no ObjectId, no Date, no Buffer. Coerce or stringify complex types before returning.
12. Connection pooling is handled by `MongoClient` internally. Do not implement custom pooling.

## Acceptance Criteria

- `find="users" where="active==true && role==admin" sort="name:asc" limit=10 columns="name:Name,email:Email"` calls `db.users.find({ active: true, role: "admin" }, { name: 1, email: 1, _id: 0 }).sort({ name: 1 }).limit(10)`
- `count="users" where="active==true"` calls `db.users.countDocuments({ active: true })`
- `one="users" where="email==env.ADMIN_EMAIL"` calls `db.users.findOne({ email: resolvedValue })` (env already resolved)
- `aggregate="orders" group="status" count=true sum="amount"` generates `$group` pipeline with `count: { $sum: 1 }` and `sum_amount: { $sum: "$amount" }`
- OR filter `where="status==pending || status==processing"` produces `{ $or: [{ status: "pending" }, { status: "processing" }] }`
- Row values with MongoDB ObjectId are coerced to string before returning
- `ping()` returns false (not throws) when MongoDB is unreachable

## Dependencies

- `69-db-adapter-interface` — the DbAdapter interface this implements
- `67-db-queryplan-types` — QueryPlan and Row types
- `65-db-aggregate-operation` — AggregateOp semantics and column naming

## Known Issues

(none - imported from spec)
