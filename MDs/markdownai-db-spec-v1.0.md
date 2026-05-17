# MarkdownAI Database Query Language

## Version 1.0

> **One syntax. Every database. No SQL. No MongoDB. Just what you mean.**

The MarkdownAI database query language is a purpose-built, ultra-simple query layer that translates a single human-readable syntax into the native query language of any supported database. It lives inside the `@markdownai/engine` package and powers the `@db` directive.

The goal is not to replace SQL or MongoDB query syntax for general use. The goal is to cover the 95% of queries that anyone would ever write in a documentation context -- with syntax so readable that a non-engineer can understand it at a glance.

---

## Table of Contents

- [Philosophy](#philosophy)
- [Supported Databases](#supported-databases)
- [The Five Operations](#the-five-operations)
- [Complete Option Reference](#complete-option-reference)
- [The where Clause](#the-where-clause)
- [The sort Option](#the-sort-option)
- [The columns Option](#the-columns-option)
- [The aggregate Operation](#the-aggregate-operation)
- [The raw Escape Hatch](#the-raw-escape-hatch)
- [Translation Reference](#translation-reference)
- [QueryPlan -- Internal Representation](#queryplan----internal-representation)
- [Adapter Architecture](#adapter-architecture)
- [Security](#security)
- [Connection Setup](#connection-setup)
- [Caching](#caching)
- [Error Handling](#error-handling)
- [What the Query Language Does Not Do](#what-the-query-language-does-not-do)
- [Changelog](#changelog)

---

## Philosophy

A MarkdownAI document is read-only by design. Nobody is running transactions, performing upserts, or executing multi-step joins inside a markdown file. The database query language reflects that reality.

It covers exactly what documentation needs:

- Show me rows matching a condition
- Show me one row
- Show me a count
- Show me a grouped summary

Everything else belongs in application code, not in documentation. The query language is intentionally limited. That limitation is the feature.

**The syntax reads like instructions, not code.** Every option is a plain English word that means exactly what it says. An author who has never written SQL or a MongoDB query can read a `@db` directive and understand immediately what it does.

**The syntax is identical regardless of the underlying database.** A document querying Postgres looks identical to a document querying MongoDB. If the database changes, the document does not.

---

## Supported Databases

| Type string | Database | Driver |
|---|---|---|
| `mongodb` | MongoDB | mongodb (native driver) |
| `postgres` | PostgreSQL | pg |
| `mysql` | MySQL / MariaDB | mysql2 |
| `mssql` | Microsoft SQL Server | mssql |
| `sqlite` | SQLite | better-sqlite3 |

Each type maps to an adapter in `packages/engine/src/db/adapters/`. Adding a new database means adding one adapter file -- nothing else in the engine changes.

---

## The Five Operations

Every `@db` directive uses exactly one of five operations. The operation is specified by which keyword option is provided.

**find** -- return multiple rows matching a filter:

```markdown
@db using="primary" find="users" where="active==true" limit=10 | @render type="table"
```

**one** -- return the first row matching a filter:

```markdown
@db using="primary" one="users" where="email==env.ADMIN_EMAIL"
```

**count** -- return a single number:

```markdown
@db using="primary" count="orders" where="status==pending"
```

**aggregate** -- group rows and summarize:

```markdown
@db using="primary" aggregate="orders" group="status" count=true | @render type="bar"
```

**raw** -- native query string, bypasses translation layer entirely:

```markdown
@db using="primary" raw="SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id ORDER BY order_count DESC LIMIT 10" | @render type="table"
```

Exactly one of `find`, `one`, `count`, `aggregate`, or `raw` must be present on every `@db` directive. Using more than one is a parse error.

---

## Complete Option Reference

| Option | Applies to | Type | Description |
|---|---|---|---|
| `find` | find | string | Collection or table name |
| `one` | one | string | Collection or table name, returns first match |
| `count` | count | string | Collection or table name, returns number |
| `aggregate` | aggregate | string | Collection or table name for grouping |
| `raw` | raw | string | Native query string -- bypasses translation |
| `using` | all | string | Named connection from @connect registry |
| `uri` | all | env ref | Inline connection string (no @connect needed) |
| `where` | find, one, count, aggregate | expression | Filter condition -- full expression system |
| `sort` | find, one | `field:asc` or `field:desc` | Sort order |
| `limit` | find | number | Maximum rows returned |
| `columns` | find, one, aggregate | `field:Label,...` | Select and rename fields |
| `group` | aggregate | string | Field to group by |
| `count` | aggregate | boolean | Count rows per group |
| `sum` | aggregate | string | Field to sum per group |
| `avg` | aggregate | string | Field to average per group |
| `min` | aggregate | string | Field minimum per group |
| `max` | aggregate | string | Field maximum per group |
| `as` | all | render type | Shorthand for `\| @render type="..."` |
| `@cache` | all | cache mode | Cache modifier -- always last token on line |

Note: `count` appears both as a top-level operation (`count="collection"`) and as an aggregate option (`count=true`). The parser distinguishes them by context -- if `aggregate=` is present, `count=true` is an aggregation option.

---

## The where Clause

The `where` clause uses the full MarkdownAI expression system. Field name on the left-hand side, value on the right. Every operator already documented in the @if section applies here.

**Simple equality:**

```markdown
where="active==true"
where="status==pending"
where="role==admin"
where="tier==enterprise"
```

**Comparison:**

```markdown
where="amount>100"
where="score>=90"
where="price<50"
where="stock<=0"
```

**Logical operators:**

```markdown
where="active==true && role==admin"
where="status==pending || status==processing"
where="amount>100 && tier==premium && active==true"
```

**Null checks:**

```markdown
where="deletedAt==null"
where="email!=null"
```

**Environment variable values:**

```markdown
where="id==env.TARGET_USER_ID"
where="region==env.DEPLOY_REGION"
```

**Grouping:**

```markdown
where="(role==admin || role==editor) && active==true"
```

**The where clause is always a post-fetch filter for SQL databases and a native query filter for MongoDB.** For performance-sensitive queries where large datasets would be fetched and then filtered, include conditions in the query itself using `raw=` instead.

---

## The sort Option

Sort by one or more fields. Each sort term is `field:direction`. Multiple fields are comma-separated.

```markdown
sort="createdAt:desc"
sort="name:asc"
sort="amount:desc,name:asc"
sort="tier:asc,score:desc,name:asc"
```

Valid directions: `asc` and `desc`. Any other value is a parse error with a clear message.

---

## The columns Option

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

---

## The aggregate Operation

Groups rows by a field and computes summaries per group.

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

**Aggregate output shape:**

The result is always a flat table with `group` as the first column followed by one column per aggregation function. Ready to pipe into any render type.

```
status       | count | sum_amount | avg_amount
-------------|-------|------------|------------
pending      | 142   | 28400.00   | 200.00
processing   | 89    | 17800.00   | 200.00
complete     | 1203  | 240600.00  | 200.00
```

---

## The raw Escape Hatch

For queries that require native syntax -- complex joins, CTEs, window functions, full aggregation pipelines -- use `raw=`.

```markdown
@db using="primary" raw="SELECT u.name, COUNT(o.id) as orders FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.active = true GROUP BY u.id ORDER BY orders DESC LIMIT 10" | @render type="table"
```

MongoDB:

```markdown
@db using="analytics" raw='db.events.aggregate([{"$group":{"_id":"$type","count":{"$sum":1}}},{"$sort":{"count":-1}}])' | @render type="table"
```

**raw= requires explicit permission in `~/.markdownai/security.json`:**

```json
{
  "db": {
    "primary": {
      "allow_raw": true
    }
  }
}
```

Without `allow_raw: true`, a `raw=` query is stripped with a WARN and a clear message explaining how to enable it.

**raw= always generates a WARN in the audit log when it executes** regardless of security mode. This is intentional -- raw queries bypass the safety guarantees of the translation layer and deserve explicit logging.

**raw= is never cached automatically.** Add `@cache` explicitly if needed.

---

## Translation Reference

The same @db directive against every supported database:

```markdown
@db using="primary" find="users" where="active==true && role==admin" sort="name:asc" limit=10 columns="name:Name,email:Email"
```

**MongoDB:**

```javascript
db.users.find(
  { active: true, role: "admin" },
  { name: 1, email: 1, _id: 0 }
).sort({ name: 1 }).limit(10)
```

**PostgreSQL / MySQL / MSSQL:**

```sql
SELECT name, email
FROM users
WHERE active = true AND role = 'admin'
ORDER BY name ASC
LIMIT 10
```

**SQLite:**

```sql
SELECT name, email
FROM users
WHERE active = 1 AND role = 'admin'
ORDER BY name ASC
LIMIT 10
```

Note: SQLite uses `1`/`0` for booleans -- the adapter handles this automatically. The author always writes `active==true`.

---

**count operation:**

```markdown
@db using="primary" count="users" where="active==true"
```

MongoDB: `db.users.countDocuments({ active: true })`

SQL: `SELECT COUNT(*) FROM users WHERE active = true`

---

**one operation:**

```markdown
@db using="primary" one="users" where="email==env.ADMIN_EMAIL"
```

MongoDB: `db.users.findOne({ email: process.env.ADMIN_EMAIL })`

SQL: `SELECT * FROM users WHERE email = $1 LIMIT 1` (parameterized)

---

**aggregate operation:**

```markdown
@db using="primary" aggregate="orders" group="status" count=true sum="amount"
```

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

---

## QueryPlan -- Internal Representation

The engine parses @db options into a structured QueryPlan before any adapter sees it. Adapters receive a QueryPlan and return rows. Raw query strings never travel through QueryPlan.

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

**Where clause parsing:**

The where clause string is parsed into an array of Filter objects. Compound expressions (`&&`, `||`) produce multiple filters. Grouping with `()` controls precedence.

The current version supports AND-chained filters natively across all adapters. OR-chained filters are supported but translated differently depending on the adapter: MongoDB uses `$or`, SQL uses `OR` in the WHERE clause. Mixing AND and OR with grouping is parsed into a filter tree.

**Environment variable resolution in where clauses:**

`where="id==env.USER_ID"` -- the `env.USER_ID` token is resolved by the engine before the QueryPlan is built. The Filter object always contains a resolved value. Adapters never see raw `env.VAR` tokens.

**Type inference:**

The where clause value is inferred from its format:
- `true` / `false` → boolean
- numeric string → number
- `null` → null
- quoted string → string
- `env.VAR` → resolved string from environment
- everything else → string

Adapters receive typed values and use them correctly in parameterized queries.

---

## Adapter Architecture

```
packages/engine/src/db/
  query.ts            -- parses @db options into QueryPlan
  executor.ts         -- routes QueryPlan to correct adapter, returns rows
  adapters/
    mongodb.ts        -- QueryPlan -> MongoDB driver call
    postgres.ts       -- QueryPlan -> parameterized SQL via pg
    mysql.ts          -- QueryPlan -> parameterized SQL via mysql2
    mssql.ts          -- QueryPlan -> parameterized SQL via mssql
    sqlite.ts         -- QueryPlan -> parameterized SQL via better-sqlite3
```

**Adapter interface:**

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

**Adding a new adapter:**

1. Create `packages/engine/src/db/adapters/<name>.ts` implementing `DbAdapter`
2. Add the type string to the `supported_types` constant in `executor.ts`
3. Done -- nothing else changes

**Connection lifecycle:**

The MCP server establishes connections at startup and keeps them alive for the session. The CLI (mai render, mai build) opens connections on demand and closes them after the command completes. Adapters are responsible for connection pooling internally.

---

## Security

**The query language is read-only by design.**

The simple query operations (find, one, count, aggregate) only produce SELECT/find queries. No adapter generates INSERT, UPDATE, DELETE, or DROP from a QueryPlan. This is structural -- the QueryPlan has no fields for write operations. It is impossible to accidentally trigger a write through the query language.

**`raw=` is the only way to potentially write data**, which is why it requires explicit `allow_raw: true` in the security config and always generates an audit log entry.

**SQL injection is structurally impossible in the query language.** Where clause values flow through typed Filter objects and are bound as parameterized query parameters. They never land in a raw query string. MongoDB adapters use typed objects -- user values never appear as operator keys.

**The security config for @db:**

```json
{
  "db": {
    "primary": {
      "allowed_operations": ["find", "one", "count", "aggregate"],
      "denied_operations": [],
      "allowed_collections": [],
      "denied_collections": [],
      "allow_raw": false,
      "readonly": true,
      "max_results": 1000
    }
  }
}
```

`allowed_collections` -- if non-empty, only these collections/tables can be queried. Everything else is blocked.

`denied_collections` -- these collections/tables are always blocked regardless of other config.

`max_results` -- hard cap on rows returned. A `find` that would return more rows than `max_results` is silently limited. Logged at WARN.

**Built-in always_block database rules** (immutable, cannot be disabled):

These patterns are blocked at the directive level before the query ever reaches an adapter, even with `allow_raw: true`:

- `DROP *`, `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`
- `DELETE FROM *`, `UPDATE * SET *`, `ALTER TABLE *`
- `CREATE USER *`, `GRANT *`, `REVOKE *`
- `db.dropDatabase()`, `db.*.drop()`, `db.*.deleteMany()`, `db.*.remove()`
- `db.*.updateMany()`, `db.*.insertMany()`
- `db.admin().*`, `db.runCommand({shutdown*}`, `db.runCommand({fsync*}`

---

## Connection Setup

Connections are declared with `@connect` in the document and referenced by name in `@db` with `using=`. See the @connect directive documentation in the main spec.

**Single connection -- `using` is optional:**

```markdown
@connect db type="mongodb" uri=env.MONGODB_URI

@db find="users" where="active==true" | @render type="table"
```

**Multiple connections -- `using` required:**

```markdown
@connect primary type="postgres" uri=env.POSTGRES_URI
@connect analytics type="mongodb" uri=env.MONGO_URI

@db using="primary" find="users" where="active==true"
@db using="analytics" find="events" where="type==pageview" limit=10
```

**Inline connection -- no @connect needed:**

```markdown
@db uri=env.POSTGRES_URI find="users" where="active==true"
```

Connection strings always reference environment variables. Never hardcode credentials.

---

## Caching

The `@cache` modifier works on all @db operations. See the Caching section in the main spec for full documentation.

**Strongly recommended for AI sessions:**

```markdown
@db using="primary" find="users" where="active==true" @cache session | @render type="table"
```

`@cache session` guarantees that the AI sees identical data for the entire session regardless of what changes in the database between phase reads. This is a correctness guarantee, not just a performance optimization.

**Development fixture workflow:**

```bash
mai cache seed input.md --env .env.production --directive db
mai watch input.md
```

Seed real data from production once. Work offline with realistic data indefinitely.

---

## Error Handling

**Parse errors** (invalid options, missing required option, conflicting operations) are always FATAL. The document halts with a clear message explaining what is wrong and how to fix it.

```
ERROR: @db directive requires exactly one operation (find, one, count, aggregate, or raw)

  File:   ./docs/status.md
  Line:   34
  Found:  find="users" and count="users" on the same directive

  Use one operation per @db directive. For multiple queries, use multiple directives.
```

**Runtime errors** (connection failure, query timeout, adapter error) produce empty output with an ERROR log entry. With `--strict`, they halt the build.

**No results** -- an operation that returns zero rows produces an empty string. No error. No warning. Pipe into @render and get an empty table with headers, or pipe into wc -l and get 0.

**max_results hit** -- WARN logged, query result silently truncated to max_results. The document continues rendering.

---

## What the Query Language Does Not Do

**Joins.** Use `raw=` for anything requiring a JOIN.

**Subqueries.** Use `raw=` for anything requiring a subquery.

**Window functions.** Use `raw=`.

**Multi-collection/multi-table operations.** Use multiple @db directives or `raw=`.

**Write operations of any kind.** MarkdownAI documents are read-only. No INSERT, UPDATE, DELETE, DROP, or any equivalent through any operation including `raw=` -- the built-in immutable rules block these patterns in raw queries regardless of config.

**Schema introspection.** List collections, show table structure, describe indexes -- these are database-specific system queries. Use `raw=` for schema introspection and render the results as a table.

The query language is intentionally narrow. The escape hatch is always available for anything outside its scope.

---

## Changelog

### v1.0

- Initial specification
- Five operations: find, one, count, aggregate, raw
- where clause using full MarkdownAI expression system
- sort, limit, columns options
- aggregate with count, sum, avg, min, max
- Five database adapters: mongodb, postgres, mysql, mssql, sqlite
- QueryPlan intermediate representation
- DbAdapter interface
- raw= escape hatch with allow_raw security config
- Built-in immutable block patterns for destructive operations
- Read-only by design -- no write operations possible through QueryPlan
- SQL injection structurally impossible through parameterized query binding
- max_results hard cap in security config
- @cache support on all operations
- Connection via @connect registry or inline uri=
