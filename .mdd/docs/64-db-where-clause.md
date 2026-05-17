---
id: 64-db-where-clause
title: DB — where Clause Parser
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-1
wave_status: complete
edition: Both
depends_on: [63-db-query-language]
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
tags: [db, where, filter, expression, type-inference, env, and, or, operators]
path: DB/Query Language
known_issues: []
---

# 64 — DB — where Clause Parser

## What to Build

This SPEC describes how the `where=` option on @db directives is parsed into an array of `Filter` objects. The implementing COMPONENT is `packages/engine/src/db/query.ts` (the same parser that handles all @db options).

The where clause accepts a string expression using the full MarkdownAI expression system. Field name on the left-hand side, value on the right. The parser resolves environment variable references and infers value types before the QueryPlan is built. Adapters receive only fully-resolved, typed Filter objects.

## Architecture

The where clause parser runs as part of the @db option parser in `query.ts`. It sits between raw @db directive text and the QueryPlan. It must resolve `env.VAR` tokens, infer value types, and structure compound expressions (AND/OR chains, grouping) into a filter tree.

Depends on `63-db-query-language` for the option syntax that wraps it. Its output feeds `67-db-queryplan-types` (the Filter[] field in QueryPlan).

## Implementation Notes

Environment variable resolution happens here, before the QueryPlan is built. Adapters never see raw `env.VAR` tokens. The Filter object always contains a resolved, typed value.

For SQL databases, the where clause is a post-fetch filter. The adapter fetches rows, then applies the filter in memory. For MongoDB, the where clause translates to a native query filter applied at the DB level.

For performance-sensitive queries where large datasets would be fetched and then filtered, authors should use `raw=` instead. This behavior should be documented in the error/warning messages.

## Data Model

**Filter interface** (see `67-db-queryplan-types` for full QueryPlan):

```typescript
interface Filter {
  field: string
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string | number | boolean | null
}
```

The `where` field on QueryPlan is `Filter[]`. Compound expressions produce multiple Filter objects.

**Type inference rules:**

| Input format | Resolved type |
|---|---|
| `true` or `false` | boolean |
| numeric string (e.g. `100`, `3.14`) | number |
| `null` | null |
| quoted string | string |
| `env.VAR` | resolved string from environment |
| everything else | string |

## API / Interface

**Supported operators:**

```markdown
where="active==true"         # equality
where="status!=pending"      # inequality
where="amount>100"           # greater than
where="score>=90"            # greater than or equal
where="price<50"             # less than
where="stock<=0"             # less than or equal
where="deletedAt==null"      # null check
where="email!=null"          # not null
```

**Logical operators:**

```markdown
where="active==true && role==admin"
where="status==pending || status==processing"
where="amount>100 && tier==premium && active==true"
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

## Business Rules

1. The where clause string is parsed into an array of Filter objects.
2. Compound expressions (`&&`, `||`) produce multiple filters.
3. Grouping with `()` controls precedence and is parsed into a filter tree.
4. AND-chained filters are natively supported across all adapters.
5. OR-chained filters are supported but translated differently by adapter: MongoDB uses `$or`, SQL uses `OR` in the WHERE clause.
6. Mixing AND and OR with grouping is parsed into a filter tree.
7. `env.VAR` tokens are resolved by the engine before the QueryPlan is built. Adapters never see raw `env.VAR` tokens.
8. The Filter object always contains a resolved, typed value.
9. For SQL databases, the where clause is a post-fetch filter applied in memory. For MongoDB, it becomes a native query filter.
10. Authors requiring server-side filtering on SQL databases should use `raw=` for performance.

## Acceptance Criteria

- `where="active==true"` produces `[{ field: "active", operator: "==", value: true }]` (boolean, not string)
- `where="amount>100"` produces `[{ field: "amount", operator: ">", value: 100 }]` (number, not string)
- `where="deletedAt==null"` produces `[{ field: "deletedAt", operator: "==", value: null }]`
- `where="id==env.USER_ID"` with `USER_ID=abc123` in env produces `[{ field: "id", operator: "==", value: "abc123" }]` (env token resolved, never passed to adapter)
- `where="active==true && role==admin"` produces two Filter objects
- `where="status==pending || status==processing"` produces two Filter objects with OR semantics
- `where="(role==admin || role==editor) && active==true"` is parsed as a tree: OR group for role AND active==true
- MongoDB adapter translates OR filter to `$or` query
- SQL adapter translates OR filter to `OR` in WHERE clause

## Dependencies

- `63-db-query-language` — the @db directive SPEC that includes the `where=` option
- `67-db-queryplan-types` — the Filter[] type that this parser produces

## Known Issues

(none - imported from spec)
