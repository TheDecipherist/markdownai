---
id: 63-db-query-language
title: DB — @db Directive Query Language
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-1
wave_status: complete
edition: Both
depends_on: [17-lang-connect, 13-lang-pipeline]
source_files:
  - packages/parser/src/directives/db.ts
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
tags: [db, database, query-language, find, one, count, aggregate, raw, directives]
path: DB/Query Language
known_issues: []
---

# 63 — DB — @db Directive Query Language

## What to Build

This is the SPEC for the `@db` directive surface: what syntax is valid, what operations are available, what every option does, and what the directive must never do. The implementing COMPONENT is `68-db-executor` (the parser in `packages/engine/src/db/query.ts`).

The @db directive executes a database query and returns rows as pipeable output. It is jailed - stripped by default unless `@db` is configured in `~/.markdownai/security.json`. It connects to a named connection from the @connect registry or to an inline URI, executes exactly one of five operations, and returns typed rows that can be piped into @render or any other downstream directive.

## Architecture

The @db directive sits in the engine's source directive category. It requires:
- `17-lang-connect` to resolve `using=` references
- `13-lang-pipeline` for the pipe (`|`) operator that passes rows downstream
- `28-caching` for `@cache` modifier support

The directive is parsed by `packages/engine/src/db/query.ts` into a QueryPlan (see `67-db-queryplan-types`) and executed by `68-db-executor`.

## Implementation Notes

Every option is a plain English word that means exactly what it says. The syntax is database-agnostic: a document querying Postgres looks identical to a document querying MongoDB. If the database changes, the document does not.

The query language is intentionally read-only. It is structurally impossible to write data through a QueryPlan. Only `raw=` can potentially issue write queries, but immutable block rules prevent all known write patterns regardless.

## Data Model

**Supported databases:**

| Type string | Database | Driver |
|---|---|---|
| `mongodb` | MongoDB | mongodb (native driver) |
| `postgres` | PostgreSQL | pg |
| `mysql` | MySQL / MariaDB | mysql2 |
| `mssql` | Microsoft SQL Server | mssql |
| `sqlite` | SQLite | better-sqlite3 |

Each type maps to an adapter in `packages/engine/src/db/adapters/`. Adding a new database means adding one adapter file - nothing else changes.

## API / Interface

**Five operations - exactly one must be present per @db directive:**

```markdown
@db using="primary" find="users" where="active==true" limit=10 | @render type="table"
@db using="primary" one="users" where="email==env.ADMIN_EMAIL"
@db using="primary" count="orders" where="status==pending"
@db using="primary" aggregate="orders" group="status" count=true | @render type="bar"
@db using="primary" raw="SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id ORDER BY order_count DESC LIMIT 10" | @render type="table"
```

**Complete option reference:**

| Option | Applies to | Type | Description |
|---|---|---|---|
| `find` | find | string | Collection or table name |
| `one` | one | string | Collection or table name, returns first match |
| `count` | count | string | Collection or table name, returns number |
| `aggregate` | aggregate | string | Collection or table name for grouping |
| `raw` | raw | string | Native query string - bypasses translation |
| `using` | all | string | Named connection from @connect registry |
| `uri` | all | env ref | Inline connection string (no @connect needed) |
| `where` | find, one, count, aggregate | expression | Filter condition - full expression system |
| `sort` | find, one | `field:asc` or `field:desc` | Sort order |
| `limit` | find | number | Maximum rows returned |
| `columns` | find, one, aggregate | `field:Label,...` | Select and rename fields |
| `group` | aggregate | string | Field to group by |
| `count` | aggregate | boolean | Count rows per group |
| `sum` | aggregate | string | Field to sum per group |
| `avg` | aggregate | string | Field to average per group |
| `min` | aggregate | string | Field minimum per group |
| `max` | aggregate | string | Field maximum per group |
| `as` | all | render type | Shorthand for `| @render type="..."` |
| `@cache` | all | cache mode | Cache modifier - always last token on line |

**sort option:**

Sort by one or more fields. Each sort term is `field:direction`. Multiple fields are comma-separated.

```markdown
sort="createdAt:desc"
sort="name:asc"
sort="amount:desc,name:asc"
sort="tier:asc,score:desc,name:asc"
```

Valid directions: `asc` and `desc`. Any other value is a parse error with a clear message.

**columns option:**

Select which fields to return and optionally rename them for display. Syntax: `field:Label` pairs, comma-separated.

```markdown
columns="name:Name,email:Email,role:Role"
columns="id:ID,createdAt:Created,status:Status"
```

Dot-notation for nested fields:

```markdown
columns="profile.firstName:First Name,profile.lastName:Last Name,email:Email"
```

Without `columns`, all fields are returned.

**Connection options:**

```markdown
# Single @connect - using= optional
@connect db type="mongodb" uri=env.MONGODB_URI
@db find="users" where="active==true"

# Multiple @connect - using= required
@connect primary type="postgres" uri=env.POSTGRES_URI
@connect analytics type="mongodb" uri=env.MONGO_URI
@db using="primary" find="users" where="active==true"
@db using="analytics" find="events" where="type==pageview" limit=10

# Inline connection - no @connect needed
@db uri=env.POSTGRES_URI find="users" where="active==true"
```

Connection strings always reference environment variables. Never hardcode credentials.

## Business Rules

1. Exactly one of `find`, `one`, `count`, `aggregate`, or `raw` must be present per @db directive. Using more than one is a FATAL parse error.
2. `count` appears both as a top-level operation (`count="collection"`) and as an aggregate option (`count=true`). The parser distinguishes them by context: if `aggregate=` is present, `count=true` is an aggregation option.
3. `sort` applies to `find` and `one` only. Using `sort` with `count` is a parse error.
4. `limit` applies to `find` only.
5. `columns` applies to `find`, `one`, and `aggregate`. Not valid with `count`.
6. Connection resolution order: (1) `using="name"` looks up named @connect, (2) `uri=env.VAR` inline, (3) single @connect defined - used automatically, (4) no connection resolvable = FATAL.
7. The @db directive is jailed - it is stripped silently unless configured in `~/.markdownai/security.json`.
8. `@cache` modifier always appears as the last token on the line, before any pipe.
9. The directive produces empty string output (no error, no warning) when a query returns zero rows.

**What the query language does not do:**
- Joins: use `raw=` for anything requiring a JOIN
- Subqueries: use `raw=` for anything requiring a subquery
- Window functions: use `raw=`
- Multi-collection/multi-table operations: use multiple @db directives or `raw=`
- Write operations of any kind: the query language is read-only by design; immutable block rules prevent all write patterns in `raw=` too
- Schema introspection: use `raw=` for listing collections, describing tables, showing indexes

## Acceptance Criteria

- Parsing `find="users" where="active==true" limit=10 columns="name:Name"` produces a valid QueryPlan with correct fields
- Parsing two operations on one directive (e.g. `find="users" count="users"`) raises FATAL with the exact error format
- `count=true` inside an `aggregate=` directive is parsed as AggregateOp, not as a top-level count operation
- `sort` with an invalid direction (not `asc` or `desc`) raises a FATAL parse error with a clear message
- Multi-field sort `sort="amount:desc,name:asc"` produces two SortTerm objects in correct order
- Dot-notation in `columns` (e.g. `profile.firstName:First`) is preserved in the ColumnMap field path
- Single @connect with no `using=` on @db resolves automatically to that connection
- `uri=env.VAR` on @db bypasses @connect registry entirely

## Dependencies

- `17-lang-connect` — @connect registry that `using=` resolves against
- `13-lang-pipeline` — pipe operator (`|`) that passes rows to downstream directives
- `67-db-queryplan-types` — the QueryPlan type produced by parsing this directive
- `68-db-executor` — the COMPONENT that implements this SPEC

## Known Issues

(none - imported from spec)
