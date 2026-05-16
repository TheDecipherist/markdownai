---
id: 11-lang-import
title: Language — @import Definition Import
edition: Both
depends_on: [09-lang-file-resolution, 07-lang-env]
source_files:
  - packages/parser/src/directives/import.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [import, module-system, definitions, fallback-registry, circular-detection]
path: Language/Import
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 11 — Language — @import Definition Import

## Purpose

Imports only definitions from a file -- macros, connections, env fallbacks. Nothing ever renders from an imported file.

## Business Rules

- Syntax: `@import ./relative/path.md`
- Nothing renders ever -- all content nodes discarded
- `@cache session` supported -- caches the definition registration, prevents re-parsing
- `@local` not valid on @import -- definitions from an import always register into parent scope

**Processing pipeline:**
1. Parse imported file
2. Check for @phase nodes → PARSE ERROR if found (phases only valid in root document)
3. Extract and register:
   a. @define macros → macro registry
   b. @connect connections → connection registry
   c. @env VAR fallback="x" → envFallbacks registry
   d. @env VAR (no fallback) → register as expected, WARN if unset during validate
4. Discard all content nodes
5. Continue processing parent document

**Stripper behavior:** removes @import directive line entirely. Never registers definitions (engine concern).

## Known Issues
(none)
