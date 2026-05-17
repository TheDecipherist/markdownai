---
id: 67-db-queryplan-types
title: DB — QueryPlan Type System
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-1
wave_status: complete
edition: Both
depends_on: [64-db-where-clause, 65-db-aggregate-operation]
source_files:
  - packages/engine/src/db/query.ts
routes: []
models: []
test_files:
  - packages/engine/src/db/__tests__/query.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1
tags: [db, queryplan, types, filter, sortterm, columnmap, aggregateop, typescript]
path: DB/Internals
known_issues: []
---

# 67 — DB — QueryPlan Type System

## What to Build

This SPEC defines the TypeScript types that form the intermediate representation between the @db directive parser and the database adapters. These types must be defined in `packages/engine/src/db/query.ts` and exported for use by all adapters.

The QueryPlan is the core abstraction that makes the database-agnostic syntax possible. The parser produces a QueryPlan. Every adapter consumes a QueryPlan. Raw query strings never travel through QueryPlan.

## Architecture

The QueryPlan types sit between `68-db-executor` (which produces them) and the adapters in Wave 2 (which consume them). They are pure data structures with no methods. Adapters import them from `query.ts`.

The type definitions here are canonical - adapters must not redefine or shadow them.

## Implementation Notes

These are the exact TypeScript interfaces from the spec, copied verbatim. Do not paraphrase or restructure them. Adapters receive typed values from the Filter interface and must use parameterized queries - they never construct raw query strings by concatenating Filter values.

The `Operation` type does not include `"raw"` because raw queries bypass the QueryPlan entirely. This is by design.

## Data Model

```typescript
type Operation = "find" | "one" | "count" | "aggregate"

interface Filter {
  field: string
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string | number | boolean | null
}

interface SortTerm {
  field: string
  dir: "asc" | "desc"
}

interface ColumnMap {
  field: string    // source field name (supports dot-notation)
  label: string    // display label
}

interface AggregateOp {
  func: "count" | "sum" | "avg" | "min" | "max"
  field: string | null    // null for count (no field needed)
  label: string           // output column name e.g. "sum_amount"
}

interface QueryPlan {
  operation: Operation
  collection: string
  where: Filter[]
  sort: SortTerm[]
  limit: number | null
  columns: ColumnMap[]
  group: string | null
  aggregations: AggregateOp[]
}
```

**Row type (returned by all adapter execute calls):**

```typescript
type Row = Record<string, string | number | boolean | null>
```

## API / Interface

All types are exported from `packages/engine/src/db/query.ts`. Adapters import:

```typescript
import type { QueryPlan, Filter, SortTerm, ColumnMap, AggregateOp, Operation, Row } from '../query.js'
```

## Business Rules

1. `Operation` is `"find" | "one" | "count" | "aggregate"` only. `"raw"` is not an Operation type - raw queries bypass the QueryPlan.
2. `Filter.value` is always a resolved, typed value. Adapters never receive `env.VAR` tokens.
3. `Filter.value` is typed as `string | number | boolean | null` matching the type inference rules from `64-db-where-clause`.
4. `ColumnMap.field` supports dot-notation for nested fields (e.g. `profile.firstName`).
5. `AggregateOp.field` is `null` for `count` (no input field needed), non-null for `sum`, `avg`, `min`, `max`.
6. `AggregateOp.label` is the output column name (`count`, `sum_amount`, `avg_price`, etc.).
7. `QueryPlan.limit` is `null` when no `limit=` option is specified.
8. `QueryPlan.group` is `null` when not an aggregate operation.
9. `QueryPlan.aggregations` is an empty array when not an aggregate operation.
10. `QueryPlan.where` is an empty array when no `where=` option is specified.
11. `QueryPlan.sort` is an empty array when no `sort=` option is specified.
12. `QueryPlan.columns` is an empty array when no `columns=` option is specified (meaning: return all fields).
13. `Row` values are restricted to `string | number | boolean | null`. Adapters must never return complex objects, arrays, or undefined.

## Acceptance Criteria

- `Operation` type does not include `"raw"` - importing and assigning `"raw"` to an `Operation` variable causes a TypeScript compile error
- All types are exported from `query.ts` and importable by adapters
- A QueryPlan with `operation: "count"` has `aggregations: []` and `group: null`
- A QueryPlan with `operation: "aggregate"` has at least one item in `aggregations` and a non-null `group`
- All Row values serialize to JSON without loss (no undefined, no Date objects, no nested objects)
- Adapters that attempt to concatenate `Filter.value` directly into a query string fail TypeScript strict mode (values must be bound as parameters)

## Dependencies

- `64-db-where-clause` — defines Filter semantics (type inference, env resolution)
- `65-db-aggregate-operation` — defines AggregateOp semantics (label naming convention)
- `68-db-executor` — produces QueryPlan from parsed @db options
- `69-db-adapter-interface` — DbAdapter consumes QueryPlan.execute(plan)

## Known Issues

(none - imported from spec)
