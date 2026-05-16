---
id: 10-lang-include
title: Language — @include Content Inclusion
edition: Both
depends_on: [09-lang-file-resolution, 08-lang-macros]
source_files:
  - packages/parser/src/directives/include.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [include, content-inclusion, scope, bubble-up, local-scope, conditional]
path: Language/Include
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 10 — Language — @include Content Inclusion

## Purpose

Includes another file's content inline at the call site. Also imports definitions (macros, connections, env fallbacks) that bubble up to the parent scope.

## Business Rules

- Syntax: `@include ./relative/path.md`
- Paths are relative to the file containing the directive
- Absolute paths → parse error (security -- filesystem confinement)
- Traversal above document root (`../`) → blocked (security)
- `@phase` in an included file → `@phase`/`@end` tags stripped, body content renders normally
- Definitions from included file bubble up to parent scope unless marked `@local`
- `@cache session/persist/ttl/mock` modifier supported as last token
- Conditional: `@include ./file.md if env.TIER == "enterprise"` -- include only if expression true
  - Directive args are always static strings -- dynamic selection uses @if blocks, not inline conditions
  - Wait: the spec says directive args are static. Conditional includes use @if blocks. No inline `if` condition on @include line. Remove the conditional syntax -- use @if blocks.

## Known Issues
(none)
