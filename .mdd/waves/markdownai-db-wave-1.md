---
id: markdownai-db-wave-1
title: "Wave 1: Query Language Core"
initiative: markdownai-db
initiative_version: 1
status: complete
depends_on: none
demo_state: "A @db directive is parsed into a valid QueryPlan. The executor routes it to the correct adapter. All five operations (find, one, count, aggregate, raw) parse without error."
created: 2026-05-17
hash: 71b58265a608265f
---

# Wave 1: Query Language Core

## Demo-State

A @db directive is parsed into a valid QueryPlan. The executor routes it to the correct adapter. All five operations (find, one, count, aggregate, raw) parse without error.
*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Type | Status | Depends on |
|---|---------|-----|------|--------|------------|
| 1 | db-query-language | docs/63-db-query-language.md | SPEC | complete | 17-lang-connect, 13-lang-pipeline |
| 2 | db-where-clause | docs/64-db-where-clause.md | SPEC | complete | 63-db-query-language |
| 3 | db-aggregate-operation | docs/65-db-aggregate-operation.md | SPEC | complete | 63-db-query-language, 64-db-where-clause |
| 4 | db-raw-escape-hatch | docs/66-db-raw-escape-hatch.md | SPEC | complete | 63-db-query-language |
| 5 | db-queryplan-types | docs/67-db-queryplan-types.md | SPEC | complete | 64-db-where-clause, 65-db-aggregate-operation |
| 6 | db-executor | docs/68-db-executor.md | COMPONENT | complete | 67-db-queryplan-types |

## Open Research

(none - imported from spec)
