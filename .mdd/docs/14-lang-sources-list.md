---
id: 14-lang-sources-list
title: Language — @list Source Directive
edition: Both
depends_on: [13-lang-pipeline]
source_files:
  - packages/parser/src/directives/list.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [list, filesystem, json, csv, source-directive, where-filter, columns, mode]
path: Language/Sources
known_issues: []
---

# 14 — Language — @list Source Directive

## Purpose

Lists files, directories, JSON array/object items, or CSV rows. Primary filesystem listing directive.

## Business Rules

**Sources:**
- Filesystem: `@list ./src/ match="**/*.ts" type="files"` -- uses glob
- JSON array: `@list ./data/users.json path="users"` -- reads array at path
- JSON object: `@list ./package.json path="dependencies" mode="keys|values|entries"`
- CSV: `@list ./data/products.csv`

**Options table:**

| Option | Controls | Values | Default |
|---|---|---|---|
| `match` | Filesystem | glob pattern | `*` |
| `type` | Filesystem | `files`, `dirs`, `both` | `files` |
| `depth` | Filesystem | number | unlimited |
| `path` | JSON | dot-notation | root |
| `mode` | JSON objects | `keys`, `values`, `entries` | none |
| `columns` | Structured data | `key:Name,key2:Name2` | all |
| `where` | Structured data | full expression system, field name on left | none |
| `skip` | CSV | header rows to skip | `0` |
| `collapse` | Nested data | `true` to stringify nested | false |
| `as` | Output | shorthand for `\| @render type="..."` | none |
| `@cache` | Caching | `session`, `persist`, `ttl=N`, `mock=./file.json` | none |

**Key rules:**
- `mode` and `as` are orthogonal -- `mode` extracts, `as` renders
- `where` uses full expression system -- field name on left-hand side, not env var
- `@local` not valid on @list -- not a definition directive
- `@cache` is last modifier on line

## Known Issues
(none)
