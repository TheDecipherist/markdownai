---
id: 68-db-executor
title: DB — Executor (query.ts + executor.ts)
type: COMPONENT
initiative: markdownai-db
wave: markdownai-db-wave-1
wave_status: complete
edition: Both
depends_on: [67-db-queryplan-types]
source_files:
  - packages/engine/src/db/query.ts
  - packages/engine/src/db/executor.ts
routes: []
models: []
test_files:
  - packages/engine/src/db/__tests__/query.test.ts
  - packages/engine/src/db/__tests__/executor.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1
tags: [db, executor, query-parser, adapter-routing, connection-lifecycle, supported-types]
path: DB/Internals
known_issues: []
---

# 68 — DB — Executor (query.ts + executor.ts)

## What to Build

Two files in `packages/engine/src/db/`:

- `query.ts` — parses raw @db directive options into a QueryPlan. Handles type inference, env var resolution, and where clause parsing. Exports all QueryPlan types.
- `executor.ts` — receives a QueryPlan (or raw string), looks up the correct adapter by connection type string, routes to the adapter's `execute()` or `executeRaw()` method, and returns `Row[]`.

These two files are the core of the DB query engine. No adapter or directive handler should need to know about the other.

## Architecture

```
packages/engine/src/db/
  query.ts      -- parses @db options into QueryPlan, exports all types
  executor.ts   -- routes QueryPlan to correct adapter, returns rows
  adapters/
    mongodb.ts
    postgres.ts
    mysql.ts
    mssql.ts
    sqlite.ts
```

The engine calls `query.ts` to parse, then `executor.ts` to execute. The executor holds the adapter registry. Adapters are registered by their type string (e.g. `"mongodb"`, `"postgres"`).

## Implementation Notes

`executor.ts` must export a `supported_types` constant (an array of valid type strings). When a new adapter is added, only two things change: the new adapter file is created, and the type string is added to `supported_types`. Nothing else in the engine changes.

Connection lifecycle differs by runtime:
- MCP server: establish connections at startup, keep alive for the session
- CLI (mai render, mai build): open connections on demand, close after the command completes

Adapters are responsible for connection pooling internally. The executor does not pool.

For `raw=` queries, the executor checks `allow_raw` in the security config before calling `adapter.executeRaw()`. If `allow_raw` is false, the query is stripped with a WARN. If `allow_raw` is true, a WARN is written to the audit log unconditionally, then `executeRaw()` is called.

## Data Model

**Directory layout:**

```
packages/engine/src/db/
  query.ts
  executor.ts
  adapters/
    mongodb.ts
    postgres.ts
    mysql.ts
    mssql.ts
    sqlite.ts
```

**executor.ts exports:**

```typescript
const supported_types = ["mongodb", "postgres", "mysql", "mssql", "sqlite"] as const
type DbType = typeof supported_types[number]

async function execute(plan: QueryPlan, connection: ResolvedConnection): Promise<Row[]>
async function executeRaw(query: string, connection: ResolvedConnection, securityConfig: DbSecurityConfig): Promise<Row[]>
```

## API / Interface

**Adding a new database adapter:**

1. Create `packages/engine/src/db/adapters/<name>.ts` implementing `DbAdapter`
2. Add the type string to the `supported_types` constant in `executor.ts`
3. Done - nothing else changes

**Connection lifecycle contract:**
- MCP server: call `adapter.connect()` at startup, `adapter.disconnect()` on shutdown
- CLI: call `adapter.connect()` before executing, `adapter.disconnect()` after command completes
- Adapters handle pooling internally - the executor does not manage connection state

## Business Rules

1. `query.ts` must resolve all `env.VAR` tokens before building the QueryPlan. The QueryPlan must contain only resolved, typed values.
2. `executor.ts` must look up the adapter by connection type string from `supported_types`. An unrecognized type string is a FATAL error.
3. For non-raw operations, `executor.ts` calls `adapter.execute(plan)` and returns the result.
4. For raw operations, `executor.ts` checks `allow_raw` in security config before calling `adapter.executeRaw(query)`. If false, strips the directive with a WARN.
5. If `allow_raw` is true, `executor.ts` writes a WARN to the audit log unconditionally before calling `executeRaw()`.
6. The executor never constructs query strings from user input. All user values go through the QueryPlan type system and arrive at adapters as typed parameters.
7. `query.ts` exports all QueryPlan types (`QueryPlan`, `Filter`, `SortTerm`, `ColumnMap`, `AggregateOp`, `Operation`, `Row`) for adapter use.
8. `query.ts` is the single source of type definitions - adapters must not redefine these types.

## Acceptance Criteria

- `query.ts` parses `find="users" where="active==true" sort="name:asc" limit=10 columns="name:Name"` into a valid QueryPlan with correct field values and types
- `query.ts` resolves `env.ADMIN_EMAIL` from the process environment before building the QueryPlan
- `query.ts` raises FATAL when two operations are present on one directive
- `executor.ts` routes to the correct adapter based on connection type string
- `executor.ts` raises FATAL when connection type string is not in `supported_types`
- `executor.ts` blocks raw execution and emits WARN when `allow_raw` is false
- `executor.ts` emits unconditional WARN to audit log when executing a raw query with `allow_raw: true`
- All five adapters can be swapped without changing any code in `query.ts` or `executor.ts`
- A sixth adapter can be added by creating one file and adding one string to `supported_types`

## Dependencies

- `67-db-queryplan-types` — the QueryPlan types this component produces and exports
- `63-db-query-language` — the @db directive SPEC this component implements
- `64-db-where-clause` — where clause parsing rules implemented here
- `66-db-raw-escape-hatch` — raw query routing and audit log behavior implemented here
- `69-db-adapter-interface` — the DbAdapter interface this component routes to
- `72-db-security` — security config consulted for allow_raw and max_results

## Known Issues

(none - imported from spec)
