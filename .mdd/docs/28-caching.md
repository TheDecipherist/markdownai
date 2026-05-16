---
id: 28-caching
title: Caching — @cache Modifier System
edition: Both
depends_on: []
source_files:
  - packages/engine/src/cache.ts
wave: markdownai-core-wave-4
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [caching, cache, session-cache, persist-cache, mock-cache, ttl, ai-consistency, fixture-system]
path: Toolchain/Cache
integration_contracts:
  - caller_feature: 03-engine
    function: applyMasking(value, ctx.security)
    when: before every SESSION_CACHE.set() and writeFileSync in writeCache
    mandatory: true
satisfies_contracts: []
known_issues: []
---

# 28 — Caching — @cache Modifier System

## Purpose

`@cache` is a modifier on any data-producing directive. Two purposes: (1) performance -- avoid re-executing expensive queries, (2) AI session consistency -- guarantee identical data across all phase reads in a session.

## Business Rules

**Cache modes:**
- `@cache` or `@cache session` -- in-memory, cleared when server stops
- `@cache ttl=300` -- session cache with 5-minute TTL
- `@cache persist` -- disk at `~/.markdownai/cache/`, survives restarts
- `@cache persist ttl=86400` -- disk with 24-hour TTL
- `@cache mock=./fixtures/data.json` -- always returns fixture, never executes directive

**@cache is always the last modifier on a directive line.**

**Cache key:** `sha256(directive_type + ":" + JSON.stringify(sortedOptions))` -- same directive type, different options = different keys.

**Masking applied before caching.** Sensitive values never stored in cache.

**AI session consistency:** `@cache session` on all @db/@http in phase documents is strongly recommended. The AI sees identical data for the entire session regardless of what changes in underlying sources. Without it, a database change mid-session causes the AI to see inconsistent state across phase reads.

**Development fixture workflow:**
```bash
mai cache seed input.md --env .env.production   # populate persist cache from real data
mai watch input.md                               # develop offline, no DB/network
mai cache clear input.md                         # refresh when needed
```

**`@cache mock`** never expires, never invalidated by `mai cache clear` -- remove the modifier to stop using mock.

**`mai cache` commands:**
- `mai cache show`, `mai cache show input.md`, `mai cache show --expired`
- `mai cache clear`, `mai cache clear --session`, `mai cache clear --persist`, `mai cache clear --directive db`
- `mai cache seed input.md`, `mai cache seed input.md --env .env.production --directive db`

**Persist cache storage:** `~/.markdownai/cache/`, permissions 700, files named by content hash.

## Known Issues
(none)
