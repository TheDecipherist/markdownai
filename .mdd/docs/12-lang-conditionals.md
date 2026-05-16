---
id: 12-lang-conditionals
title: Language — @if Conditionals and Expression System
edition: Both
depends_on: [07-lang-env, 06-lang-interpolation]
source_files:
  - packages/parser/src/directives/if.ts
  - packages/engine/src/conditions.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [conditionals, if, expressions, operators, file-existence, where]
path: Language/Conditionals
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 12 — Language — @if Conditionals and Expression System

## Purpose

`@if`/`@elseif`/`@else`/`@endif` for conditional content blocks. Also defines the canonical MarkdownAI expression system used everywhere (where clauses, interpolation, @include conditions).

## Business Rules

**This section is the canonical expression system reference. Same operators everywhere.**

**Operators:**
- `==`, `!=`, `>`, `<`, `>=`, `<=` -- comparison
- `&&`, `||` -- logical AND/OR
- `!` -- logical NOT (also negates file functions: `!file.exists "./path"`)
- `? :` -- ternary
- `?.` -- optional chain
- `??` -- nullish coalesce
- `()` -- grouping

**File existence functions (return boolean):**
- `file.exists "./path"` -- true if path exists as file or directory
- `file.isFile "./path"` -- true if path exists and is a file
- `file.isDir "./path"` -- true if path exists and is a directory
- Negation: `!file.exists "./path"`, `!file.isFile "./path"`, `!file.isDir "./path"`

**@if/@elseif/@else/@endif rules:**
- Unlimited @elseif branches, one optional @else
- Nested @if blocks supported -- track depth for @endif matching
- Left-hand side of @if conditions: env vars (`env.X == "y"`)
- Left-hand side of `where` clauses: field names on row data (`role==admin`)
- Expression evaluation: `vm.runInNewContext` with sandboxed context -- never `eval()`

**Stripper behavior when no --env provided:**
- Unset variable → empty string → comparison against non-empty value → false → @else renders
- WARN logged per unset variable: "@if references env.X -- not set, evaluates to false (line N)"
- Always provide `--env .env.production` when stripping conditional documents
- `mai validate` reports all unset vars before stripping

## Known Issues
(none)
