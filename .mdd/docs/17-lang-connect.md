---
id: 17-lang-connect
title: Language — @connect Database Registry
edition: Both
depends_on: [07-lang-env]
source_files:
  - packages/parser/src/directives/connect.ts
  - packages/engine/src/context.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [connect, database, connections, registry, local-scope, mongodb, postgres, redis]
path: Language/Connect
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 17 — Language — @connect Database Registry

## Purpose

Defines named database connections once at the top of the document. Referenced by name in @db directives throughout.

## Business Rules

**Grammar:**
```
@connect name type="mongodb" uri=env.MONGODB_URI
@connect name type="mongodb" uri=env.MONGODB_URI @local
```

**Supported types:** `mongodb`, `postgres`, `mysql`, `mssql`, `sqlite`, `redis`, `elasticsearch`

**@local:** prevents connection from bubbling up to parent scope. Useful for one-off connections in included files.

**Connection string:** always references env var (`uri=env.VAR`) -- never hardcoded credentials. Documents safe to commit.

**Resolution order for @db:**
1. `using="name"` -- looks up named @connect by name
2. `uri=env.VAR` -- inline on @db, no @connect needed
3. Single @connect defined -- used automatically
4. Error -- no connection resolvable

**Stripper behavior:** @connect directives removed entirely. Connection definitions meaningless in static output.

**Security:** @connect itself is not jailed -- it only registers a connection. @db (which uses the connection) is jailed.

## Known Issues
(none)
