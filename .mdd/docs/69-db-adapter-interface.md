---
id: 69-db-adapter-interface
title: DB — DbAdapter Interface
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-2
wave_status: planned
edition: Both
depends_on: [67-db-queryplan-types]
source_files:
  - packages/engine/src/db/adapters/mongodb.ts
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
tags: [db, adapter, interface, dbadapter, connect, disconnect, execute, ping]
path: DB/Adapters
known_issues: []
---

# 69 — DB — DbAdapter Interface

## What to Build

This SPEC defines the `DbAdapter` interface that every database adapter must implement. The interface is defined in `packages/engine/src/db/executor.ts` (or a shared types file) and is the only contract between the executor and the adapters.

Every adapter is a standalone file in `packages/engine/src/db/adapters/`. Each file exports a class or object implementing `DbAdapter`. The executor routes to them by type string. Adapters are independently replaceable.

## Architecture

The interface sits between `68-db-executor` (consumer) and the five adapter COMPONENTs (implementors). The executor only ever calls methods on `DbAdapter` - it never imports adapter-specific internals.

## Implementation Notes

Each adapter is fully responsible for its own connection pooling. The executor does not manage pool state.

`execute(plan)` translates a QueryPlan into a native query and returns typed rows. `executeRaw(query)` passes the raw string directly to the database driver. Both return `Row[]`.

`ping()` is used by the MCP server to verify connections at startup and during health checks.

## Data Model

```typescript
interface DbAdapter {
  connect(uri: string): Promise<void>
  execute(plan: QueryPlan): Promise<Row[]>
  executeRaw(query: string): Promise<Row[]>
  disconnect(): Promise<void>
  ping(): Promise<boolean>
}

type Row = Record<string, string | number | boolean | null>
```

## API / Interface

**Method contracts:**

| Method | Input | Output | Behavior |
|---|---|---|---|
| `connect(uri)` | connection string | void | Establishes connection. Throws on failure. |
| `execute(plan)` | QueryPlan | Row[] | Translates plan to native query, executes, returns typed rows. |
| `executeRaw(query)` | native query string | Row[] | Passes query directly to driver, returns typed rows. |
| `disconnect()` | — | void | Closes connection. Safe to call if not connected. |
| `ping()` | — | boolean | Returns true if connection is alive. Does not throw. |

**Adding a new adapter:**

1. Create `packages/engine/src/db/adapters/<name>.ts` implementing `DbAdapter`
2. Add the type string to `supported_types` in `executor.ts`
3. Done

## Business Rules

1. All adapters must implement the full `DbAdapter` interface. Partial implementations cause TypeScript compilation failure.
2. `connect()` must throw a descriptive error if the connection cannot be established.
3. `execute(plan)` must use parameterized queries. User values from `Filter.value` must never be concatenated into query strings.
4. `executeRaw(query)` passes the string directly to the driver without modification. The executor is responsible for security checks before calling this method.
5. `disconnect()` must be safe to call even if the adapter was never connected. Must not throw.
6. `ping()` must return `false` (not throw) if the connection is unhealthy.
7. All `Row` values returned by `execute()` and `executeRaw()` must conform to `Record<string, string | number | boolean | null>`. No nested objects, no arrays, no Date objects, no undefined.
8. Adapters handle connection pooling internally. The executor does not manage pool state.
9. Each adapter file is self-contained. It may import the `DbAdapter` interface and QueryPlan types, but must not import from other adapter files.

## Acceptance Criteria

- All five adapter files implement `DbAdapter` - failing to implement any method causes a TypeScript compile error
- `execute()` with `where` filters uses parameterized query binding, never string concatenation
- `ping()` returns `false` (not throws) when the database is unreachable
- `disconnect()` does not throw when called on an unconnected adapter
- Row values from any adapter serialize cleanly to JSON (no undefined, no Date, no complex types)
- A sixth adapter can be added by creating one file implementing `DbAdapter` without modifying any existing file

## Dependencies

- `67-db-queryplan-types` — `QueryPlan`, `Row`, and related types that this interface references
- `68-db-executor` — the component that consumes this interface
- `70-db-mongodb-adapter` — COMPONENT that implements this SPEC for MongoDB
- `71-db-sql-adapters` — COMPONENT that implements this SPEC for PostgreSQL, MySQL, MSSQL, SQLite

## Known Issues

(none - imported from spec)
