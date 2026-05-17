---
id: 73-db-caching
title: DB — Caching Integration
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-3
wave_status: planned
edition: Both
depends_on: [68-db-executor, 28-caching]
source_files:
  - packages/engine/src/db/executor.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: draft
phase: documentation
mdd_version: 1
tags: [db, caching, cache-session, cache-persist, seed, offline, fixture, ai-session]
path: DB/Caching
known_issues: []
---

# 73 — DB — Caching Integration

## What to Build

This SPEC describes how the `@cache` modifier integrates with @db directives. The @cache modifier works on all @db operations using the same cache system defined in `28-caching`. This doc covers the DB-specific behavior: why `@cache session` is a correctness guarantee for AI sessions, and the development fixture workflow using `mai cache seed`.

The implementing COMPONENT is `68-db-executor` combined with the cache layer from `28-caching`.

## Architecture

The `@cache` modifier is the last token on the @db line (before any pipe). The executor checks for a cache hit before calling any adapter. On a cache miss, the executor runs the query and stores the result under the cache key derived from the directive options. See `28-caching` for full cache key construction and storage mechanics.

The DB-specific behavior is that `raw=` queries are never cached automatically (they need `@cache` explicitly). All other operations cache normally.

## Implementation Notes

`@cache session` is not just a performance optimization for @db - it is a correctness guarantee. In AI sessions, the engine reads a document in multiple phases. Without session caching, a query that returns different data between phases (e.g. an order count that changes) produces inconsistent context. `@cache session` guarantees identical data for the entire session.

The development fixture workflow: `mai cache seed input.md --env .env.production --directive db` runs all @db directives against the real database, stores results in the persist cache, then `mai watch input.md` uses the cached data for all subsequent renders without connecting to the database.

## Data Model

The cache key for a @db operation is derived from: connection URI (or named connection), operation type, collection name, where clause, sort, limit, columns, and aggregation options. Two directives with identical options share a cache entry.

See `28-caching` for the full cache modes (`session`, `persist`, `ttl=N`, `mock=./file.json`) and storage format.

## API / Interface

**Cache modifier syntax (same as all other directives):**

```markdown
@db using="primary" find="users" where="active==true" @cache session | @render type="table"
@db using="primary" find="orders" where="status==pending" @cache persist
@db using="primary" count="events" @cache ttl=300
```

**Development fixture workflow:**

```bash
# Seed real data from production once
mai cache seed input.md --env .env.production --directive db

# Work offline with realistic data indefinitely
mai watch input.md
```

**Explicit cache for raw queries:**

```markdown
@db using="primary" raw="SELECT ..." @cache session | @render type="table"
```

## Business Rules

1. `@cache` works on all @db operations: `find`, `one`, `count`, `aggregate`.
2. `raw=` is never cached automatically. Add `@cache` explicitly if caching is needed.
3. `@cache session` for @db is a correctness guarantee for AI sessions, not just a performance optimization. It ensures the AI sees identical data across all phase reads within a session.
4. Cache key includes all options that affect the query result (connection, operation, collection, where, sort, limit, columns, aggregations). Two directives with identical options share a cache entry.
5. `@cache persist` seeds real data for offline development. `mai cache seed` populates persist-mode cache entries by running real queries.
6. All cache modes from `28-caching` apply to @db without modification: `session`, `persist`, `ttl=N`, `mock=./file.json`.
7. `@cache` is the last token before the pipe (`|`) on the directive line.

## Acceptance Criteria

- `@cache session` on a @db directive returns the same rows on every subsequent call within the session, regardless of database changes
- A @db directive with `raw=` and no `@cache` always hits the database (no automatic caching)
- `mai cache seed input.md --directive db` runs all @db directives and stores results in persist cache
- After seeding, `mai watch input.md` uses cached data without establishing a database connection
- Two @db directives with identical options (same collection, same where, same sort) share a cache hit
- `@cache ttl=300` on a @db directive expires and re-runs the query after 300 seconds

## Dependencies

- `68-db-executor` — the COMPONENT that checks for cache hits before running queries
- `28-caching` — the full cache system, modes, storage, and key construction

## Known Issues

(none - imported from spec)
