---
id: 15-lang-sources-read
title: Language — @read Source Directive
edition: Both
depends_on: [13-lang-pipeline]
source_files:
  - packages/parser/src/directives/read.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [read, json, yaml, toml, csv, env-file, structured-data]
path: Language/Sources
known_issues: []
---

# 15 — Language — @read Source Directive

## Purpose

Reads structured files and extracts values. Supports JSON, YAML, TOML, CSV, and .env. Each format has its own access option.

## Business Rules

**Access options by format (using wrong option for format is parse error):**

| Extension | Access Option | Valid Operations |
|---|---|---|
| `.json` | `path="dot.notation"` | single value, array as table, object |
| `.yaml`, `.yml` | `path="dot.notation"` | single value, array as table, object |
| `.toml` | `path="dot.notation"` | single value, array as table, object |
| `.csv` | `column="name"` | full table, single column, filtered rows |
| `.env` | `key="KEY_NAME"` | single key value only |

**Rules:**
- `path` on a `.env` file → parse error with message: "use key= for .env files"
- `path` uses dot-notation, array indices with `[n]` notation (`servers[0].host`)
- `key` is flat lookup -- no nesting, no dot-notation
- `column` extracts one column, outputs one value per line
- `where` uses full expression system, field name on left
- `columns` selects and renames fields: `key:Name,key2:Name2`
- `collapse true` stringifies nested objects inline
- `as` shorthand for `| @render type="..."`
- `@cache` supported as last modifier
- Subject to filesystem confinement and content masking (security layer)

## Known Issues
(none)
