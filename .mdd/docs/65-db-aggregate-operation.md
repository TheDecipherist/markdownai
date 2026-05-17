---
id: 65-db-aggregate-operation
title: DB — aggregate Operation
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-1
wave_status: complete
edition: Both
depends_on: [63-db-query-language, 64-db-where-clause]
source_files:
  - packages/engine/src/db/query.ts
  - packages/engine/src/db/adapters/mongodb.ts
  - packages/engine/src/db/adapters/postgres.ts
routes: []
models: []
test_files:
  - packages/engine/src/db/__tests__/query.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1
known_issues:
  - "adapters/mongodb.ts and adapters/postgres.ts are Wave 2 deliverables (70-db-mongodb-adapter, 71-db-sql-adapters). Aggregate parsing in query.ts is complete; adapter translation is deferred."
tags: [db, aggregate, group, count, sum, avg, min, max, groupby]
path: DB/Query Language
known_issues: []
---

# 65 — DB — aggregate Operation

## What to Build

This SPEC describes the `aggregate` operation on the @db directive: how grouping and aggregation functions are specified, what the output shape is, and how the operation maps to each database type. The implementing COMPONENTs are the adapters in `70-db-mongodb-adapter` and `71-db-sql-adapters`.

The aggregate operation groups rows by a field and computes one or more summary values per group. The result is always a flat table ready to pipe into any render type.

## Architecture

The aggregate operation is parsed by `query.ts` into `AggregateOp[]` objects within the QueryPlan. Each adapter translates the AggregateOp list into its native aggregation syntax: MongoDB uses `$group` in an aggregation pipeline, SQL databases use `GROUP BY` with aggregate functions.

## Implementation Notes

The output column naming convention is fixed: `<func>_<field>` for non-count aggregations. For example, `sum="amount"` produces column name `sum_amount`, `avg="revenue"` produces `avg_revenue`. `count=true` produces column named `count` (no field suffix since there is no input field).

Multiple aggregation functions can appear on a single aggregate directive - the parser must collect all of them into the AggregateOp array.

## Data Model

**AggregateOp interface** (see `67-db-queryplan-types`):

```typescript
interface AggregateOp {
  func: "count" | "sum" | "avg" | "min" | "max"
  field: string | null    // null for count (no field needed)
  label: string           // output column name e.g. "sum_amount"
}
```

**Aggregate output shape** - always a flat table, `group` value as first column:

```
status       | count | sum_amount | avg_amount
-------------|-------|------------|------------
pending      | 142   | 28400.00   | 200.00
processing   | 89    | 17800.00   | 200.00
complete     | 1203  | 240600.00  | 200.00
```

## API / Interface

**Count per group:**

```markdown
@db using="primary" aggregate="orders" group="status" count=true | @render type="bar"
```

**Sum per group:**

```markdown
@db using="primary" aggregate="orders" group="region" sum="amount" | @render type="table"
```

**Multiple aggregations:**

```markdown
@db using="primary" aggregate="orders" group="status" count=true sum="amount" avg="amount" | @render type="table"
```

**With filter:**

```markdown
@db using="primary" aggregate="orders" group="status" count=true where="createdAt>2025-01-01"
```

**Aggregation options:**

| Option | Type | Output column | Description |
|---|---|---|---|
| `group` | string | (first column, named by the grouped field value) | Field to group by |
| `count` | boolean (`true`) | `count` | Count rows per group |
| `sum` | string | `sum_<field>` | Sum of field per group |
| `avg` | string | `avg_<field>` | Average of field per group |
| `min` | string | `min_<field>` | Minimum of field per group |
| `max` | string | `max_<field>` | Maximum of field per group |

**Database translation:**

MongoDB:
```javascript
db.orders.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 }, sum_amount: { $sum: "$amount" } } }
])
```

SQL:
```sql
SELECT status, COUNT(*) as count, SUM(amount) as sum_amount
FROM orders
GROUP BY status
```

## Business Rules

1. `aggregate=` requires `group=` - grouping without a group field is a FATAL parse error.
2. At least one aggregation function (`count=true`, `sum=`, `avg=`, `min=`, `max=`) must be present.
3. `count=true` is distinguished from the top-level `count=` operation by the presence of `aggregate=`. The parser uses this context to classify `count=true` as AggregateOp.
4. Multiple aggregation functions are valid on a single directive and produce multiple output columns.
5. Output column naming: `count` for count, `<func>_<field>` for all others (e.g. `sum_amount`, `avg_price`).
6. The `group` value becomes the first column in the output. Column header is the field name used for grouping.
7. The `where=` option is valid with `aggregate=` and filters rows before grouping.
8. The `columns=` option is valid with `aggregate=` and can rename output columns.
9. The result is always a flat table, regardless of database type.

## Acceptance Criteria

- `aggregate="orders" group="status" count=true` produces AggregateOp: `[{ func: "count", field: null, label: "count" }]`
- `aggregate="orders" group="region" sum="amount"` produces AggregateOp: `[{ func: "sum", field: "amount", label: "sum_amount" }]`
- `aggregate="orders" group="status" count=true sum="amount" avg="amount"` produces 3 AggregateOp objects
- Missing `group=` with `aggregate=` raises FATAL parse error
- `aggregate=` with no aggregation function raises FATAL parse error
- MongoDB adapter translates `count=true` to `{ $sum: 1 }` in `$group`
- SQL adapter translates `count=true` to `COUNT(*) as count`
- Output shape is always a flat table with group as first column
- `where=` filters are applied before grouping

## Dependencies

- `63-db-query-language` — @db directive SPEC containing the aggregate options
- `64-db-where-clause` — where clause parsing used with aggregate
- `67-db-queryplan-types` — AggregateOp type and QueryPlan.aggregations field
- `70-db-mongodb-adapter` — implements aggregate for MongoDB
- `71-db-sql-adapters` — implements aggregate for SQL databases

## Known Issues

(none - imported from spec)
