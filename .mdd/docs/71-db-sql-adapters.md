---
id: 71-db-sql-adapters
title: DB — SQL Adapters (PostgreSQL, MySQL, MSSQL, SQLite)
type: COMPONENT
initiative: markdownai-db
wave: markdownai-db-wave-2
wave_status: planned
edition: Both
depends_on: [69-db-adapter-interface]
source_files:
  - packages/engine/src/db/adapters/postgres.ts
  - packages/engine/src/db/adapters/mysql.ts
  - packages/engine/src/db/adapters/mssql.ts
  - packages/engine/src/db/adapters/sqlite.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: draft
phase: documentation
mdd_version: 1
tags: [db, sql, postgres, mysql, mssql, sqlite, adapter, parameterized-queries, post-fetch-filter]
path: DB/Adapters
known_issues: []
---

# 71 — DB — SQL Adapters (PostgreSQL, MySQL, MSSQL, SQLite)

## What to Build

Four adapter files, one per SQL database:

- `packages/engine/src/db/adapters/postgres.ts` — uses `pg` driver
- `packages/engine/src/db/adapters/mysql.ts` — uses `mysql2` driver
- `packages/engine/src/db/adapters/mssql.ts` — uses `mssql` driver
- `packages/engine/src/db/adapters/sqlite.ts` — uses `better-sqlite3` driver

Each file implements `DbAdapter` for its database. The SQL generation logic is shared across PostgreSQL, MySQL, and MSSQL (they produce nearly identical SQL). SQLite is the same with one difference: boolean values must be coerced to `1`/`0`.

## Architecture

All four adapters implement the same `DbAdapter` interface. The SQL query construction logic can be extracted into a shared `buildSql()` helper function used by all four SQL adapters. The shared helper handles `WHERE`, `ORDER BY`, `LIMIT`, `GROUP BY`, and column selection. Each adapter then hands the SQL to its specific driver using that driver's parameterized query API.

## Implementation Notes

**Where clause behavior:** For SQL databases, the `where` clause in the QueryPlan is a post-fetch filter. This means the adapter fetches rows without a WHERE clause (or with driver-level filtering if possible for performance), then filters results in memory using the Filter array. The spec is explicit about this. For performance-sensitive queries, authors should use `raw=`.

Actually - re-reading the spec: the where clause IS used in the SQL query (see the translation reference showing `WHERE active = true AND role = 'admin'`). It is called "post-fetch filter" in the context of explaining that for MongoDB it's a native filter, while for SQL it translates to a WHERE clause. The SQL WHERE clause is generated from the Filter array using parameterized binding.

**Parameterized query binding:** All Filter values must be bound as parameters, never concatenated. Each SQL driver has its own parameter placeholder syntax:
- PostgreSQL: `$1`, `$2`, `$3` (positional)
- MySQL: `?`, `?`, `?` (positional)
- MSSQL: `@param1`, `@param2` (named)
- SQLite: `?`, `?`, `?` (positional) or `:name` (named)

**SQLite boolean coercion:** SQLite has no native boolean type. `true` becomes `1`, `false` becomes `0`. The adapter handles this automatically. The author always writes `active==true` in the @db directive.

**The one operation:** Translates to `SELECT * FROM table WHERE conditions LIMIT 1` (parameterized).

## Data Model

**QueryPlan to SQL translation:**

| QueryPlan field | SQL clause |
|---|---|
| `operation: "find"` | `SELECT ... FROM table WHERE ... ORDER BY ... LIMIT N` |
| `operation: "one"` | `SELECT * FROM table WHERE ... LIMIT 1` |
| `operation: "count"` | `SELECT COUNT(*) FROM table WHERE ...` |
| `operation: "aggregate"` | `SELECT group_field, COUNT(*)/SUM()/... FROM table [WHERE ...] GROUP BY group_field` |
| `where: Filter[]` | parameterized `WHERE` clause |
| `sort: SortTerm[]` | `ORDER BY field ASC/DESC` |
| `columns: ColumnMap[]` | `SELECT field AS label, field2 AS label2` |
| `limit: number` | `LIMIT N` |
| `group: string` | `GROUP BY field` |
| `aggregations: AggregateOp[]` | `COUNT(*) as count, SUM(field) as sum_field, ...` |

**Full find translation example:**

```sql
-- QueryPlan: find="users" where="active==true && role==admin" sort="name:asc" limit=10 columns="name:Name,email:Email"
SELECT name AS "Name", email AS "Email"
FROM users
WHERE active = $1 AND role = $2
ORDER BY name ASC
LIMIT 10
-- parameters: [true, "admin"]
```

**SQLite difference (same query):**

```sql
SELECT name AS "Name", email AS "Email"
FROM users
WHERE active = ? AND role = ?
ORDER BY name ASC
LIMIT 10
-- parameters: [1, "admin"]  (true -> 1)
```

**count translation:**

```sql
SELECT COUNT(*) FROM users WHERE active = $1
-- parameters: [true]
```

**one translation:**

```sql
SELECT * FROM users WHERE email = $1 LIMIT 1
-- parameters: ["resolved@email.com"]
```

**aggregate translation:**

```sql
SELECT status, COUNT(*) as count, SUM(amount) as sum_amount
FROM orders
GROUP BY status
```

## API / Interface

Each adapter follows the same pattern:

```typescript
// packages/engine/src/db/adapters/postgres.ts
import type { DbAdapter, QueryPlan, Row } from '../query.js'
import { Pool } from 'pg'

export class PostgresAdapter implements DbAdapter {
  connect(uri: string): Promise<void>
  execute(plan: QueryPlan): Promise<Row[]>
  executeRaw(query: string): Promise<Row[]>
  disconnect(): Promise<void>
  ping(): Promise<boolean>
}
```

## Business Rules

1. All SQL values from `Filter.value` are bound as parameterized query parameters - never concatenated into the query string.
2. SQLite boolean coercion: `true` → `1`, `false` → `0`. Applied automatically. Authors always write `true`/`false` in directives.
3. The `one` operation uses `LIMIT 1` in the SQL query. Returns empty array if no rows match.
4. `columns` translates to explicit `SELECT field AS "Label"` syntax. Without `columns`, use `SELECT *`.
5. `sort` direction `asc` → `ASC`, `desc` → `DESC`. Multiple sort terms produce a comma-separated `ORDER BY` clause.
6. OR-chained filters (`||`) translate to `OR` in the WHERE clause.
7. AND-chained filters (`&&`) translate to `AND` in the WHERE clause.
8. `count` operation returns a single-row result. The adapter must extract the numeric value and return `[{ count: N }]`.
9. MSSQL uses `TOP N` instead of `LIMIT N` for row limiting in `find` and `one` operations.
10. All Row values must conform to `Record<string, string | number | boolean | null>`. Date values from the database must be coerced to ISO string.
11. Each adapter handles its own connection pooling via the driver's native pool/client API.
12. `ping()` returns false (not throws) when the database is unreachable.
13. SQLite (`better-sqlite3`) is synchronous by driver design. Wrap synchronous calls in async functions to satisfy the `Promise<>` return types on the interface.

## Acceptance Criteria

- `find="users" where="active==true && role==admin" sort="name:asc" limit=10 columns="name:Name,email:Email"` generates the correct parameterized SQL for each driver
- SQLite translates boolean `true` to `1` and `false` to `0` in parameters
- MSSQL uses `TOP 10` (not `LIMIT 10`) for row limiting
- All four adapters use parameterized binding - no string concatenation of filter values
- `count` returns `[{ count: N }]` as a Row array
- `one` with no matching rows returns `[]` (empty array, no error)
- OR filter produces `OR` in WHERE clause across all four adapters
- Date values from database are coerced to ISO strings before returning as Row values
- `ping()` returns `false` when database is unreachable (not throws)
- SQLite's synchronous `better-sqlite3` calls are wrapped to return Promise types

## Dependencies

- `69-db-adapter-interface` — the DbAdapter interface all four adapters implement
- `67-db-queryplan-types` — QueryPlan and Row types
- `65-db-aggregate-operation` — AggregateOp semantics and column naming

## Known Issues

(none - imported from spec)
