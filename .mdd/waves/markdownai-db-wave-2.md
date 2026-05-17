---
id: markdownai-db-wave-2
title: "Wave 2: Database Adapters"
initiative: markdownai-db
initiative_version: 1
status: planned
depends_on: markdownai-db-wave-1
demo_state: "A find with where, sort, limit, and columns executes correctly against all five database types and returns typed rows."
created: 2026-05-17
hash:
---

# Wave 2: Database Adapters

## Demo-State

A find with where, sort, limit, and columns executes correctly against all five database types and returns typed rows.
*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Type | Status | Depends on |
|---|---------|-----|------|--------|------------|
| 1 | db-adapter-interface | docs/69-db-adapter-interface.md | SPEC | planned | 67-db-queryplan-types |
| 2 | db-mongodb-adapter | docs/70-db-mongodb-adapter.md | COMPONENT | planned | 69-db-adapter-interface |
| 3 | db-sql-adapters | docs/71-db-sql-adapters.md | COMPONENT | planned | 69-db-adapter-interface |

## Open Research

(none - imported from spec)
