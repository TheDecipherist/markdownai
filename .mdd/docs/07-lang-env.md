---
id: 07-lang-env
title: Language — @env Environment Variables
edition: Both
depends_on: [01-parser]
source_files:
  - packages/parser/src/directives/env.ts
  - packages/engine/src/context.ts
wave: markdownai-core-wave-2
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [env, environment-variables, fallback, resolution-order, configuration]
path: Language/Env
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 07 — Language — @env Environment Variables

## Purpose

`@env` resolves environment variables. Behavior differs by context: standalone output in a document, inline via `{{ env.VAR }}`, or fallback registration inside `@import` files.

## Business Rules

**Standalone (own line):**
- `@env VARNAME` → outputs value as paragraph
- `@env VARNAME fallback="default"` → outputs value or fallback

**Inline:** always use `{{ env.VARNAME }}` interpolation syntax for prose embedding

**Inside `@import` files:**
- `@env VAR fallback="x"` → registers VAR=x in `envFallbacks` registry. No content output.
- `@env VAR` (no fallback) → registers VAR as expected. Warns during validate if unset. No content output.
- `@import` discards all output -- only definition registration matters

**Resolution order (resolveEnv() -- must match engine.ts exactly):**
1. `process.env[key]` -- always wins
2. `envFiles[key]` -- from `--env .env.production`
3. `envFallbacks[key]` -- from @import fallback registry
4. `directiveFallback` -- `fallback=` on the directive itself
5. `""` -- empty string, never an error

## Known Issues
(none)
