---
id: 18-lang-sources-db
title: Language — @db Database Query Directive
edition: Both
depends_on: [17-lang-connect, 13-lang-pipeline]
source_files:
  - packages/parser/src/directives/db.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [db, database, mongodb, sql, query, jailed, columns, where, post-query-filter]
path: Language/Sources
known_issues: []
---

# 18 — Language — @db Database Query Directive

## Purpose

Executes database queries and returns results as pipeable output. Jailed -- stripped by default.

## Business Rules

**Jailed directive:** stripped silently unless `@db` is configured in `~/.markdownai/security.json`.

**Options:**
- `using="connection-name"` -- references @connect registry
- `uri=env.VAR` -- inline connection (no @connect needed)
- `query="..."` -- query string (MongoDB or SQL depending on connection type)
- `columns="field:Name,field2:Name2"` -- select and rename result fields
- `where="expression"` -- post-query row filter, full expression system, field name on left
- `as="type"` -- shorthand for `| @render type="..."`
- `@cache session|persist|ttl=N|mock=./file.json` -- last modifier

**`where` is a post-query filter:** for performance, include conditions in the query itself. `where` is for additional filtering on results.

**`@cache persist` development workflow:** seed real data once, develop offline with no database connection.

**Stripper:** @db directive line removed. Never executes.

## Known Issues
(none)
