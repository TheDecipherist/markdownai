---
id: markdownai-db
title: MarkdownAI Database Query Engine
status: active
version: 1
hash: c100df38feeeb9ab
created: 2026-05-17
---

# MarkdownAI Database Query Engine

## Overview

The MarkdownAI database query engine is a purpose-built query layer that translates a single human-readable syntax into the native query language of any supported database. It lives inside the `@markdownai/engine` package and powers the `@db` directive.

The goal is to cover the 95% of queries that anyone would ever write in a documentation context - with syntax so readable that a non-engineer can understand it at a glance. The syntax is identical regardless of the underlying database. A document querying Postgres looks identical to a document querying MongoDB. If the database changes, the document does not.

The query language is intentionally limited. A MarkdownAI document is read-only by design. Nobody is running transactions, performing upserts, or executing multi-step joins inside a markdown file. The database query language reflects that reality. It covers exactly what documentation needs: show me rows matching a condition, show me one row, show me a count, show me a grouped summary. Everything else belongs in application code.

The engine parses @db options into a structured QueryPlan before any adapter sees it. Adapters receive a QueryPlan and return rows. This intermediate representation is the core abstraction that makes the database-agnostic syntax possible. SQL injection is structurally impossible - where clause values flow through typed Filter objects and are bound as parameterized query parameters. They never land in a raw query string.

Five database types are supported: MongoDB, PostgreSQL, MySQL/MariaDB, Microsoft SQL Server, and SQLite. Each maps to an adapter in `packages/engine/src/db/adapters/`. Adding a new database means adding one adapter file - nothing else changes.

"Done" for this initiative means: any @db directive in any MarkdownAI document executes correctly against all five database types, returns typed rows, respects security configuration, supports caching, and fails gracefully with clear error messages.

## Open Product Questions

(none - imported from spec)

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/markdownai-db-wave-1.md | A @db directive is parsed into a valid QueryPlan. The executor routes it to the correct adapter. All five operations (find, one, count, aggregate, raw) parse without error. | complete |
| Wave 2 | waves/markdownai-db-wave-2.md | A find with where, sort, limit, and columns executes correctly against all five database types and returns typed rows. | complete |
| Wave 3 | waves/markdownai-db-wave-3.md | Security config blocks forbidden operations. raw= requires allow_raw. max_results cap truncates silently. @cache session seeds and replays. Parse errors halt the document with a clear message. | planned |
