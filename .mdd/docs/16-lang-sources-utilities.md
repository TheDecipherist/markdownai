---
id: 16-lang-sources-utilities
title: Language — @tree, @date, @count Utility Directives
edition: Both
depends_on: []
source_files:
  - packages/parser/src/directives/tree.ts
  - packages/parser/src/directives/date.ts
  - packages/parser/src/directives/count.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [tree, date, count, filesystem, ascii-tree, date-format, utility-directives]
path: Language/Sources
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 16 — Language — @tree, @date, @count Utility Directives

## Purpose

Three focused utility source directives: directory visualization (@tree), date/time injection (@date), filesystem item counting (@count).

## Business Rules

**@tree:**
- Syntax: `@tree ./path/ depth=2 match="*.ts"`
- Options: `depth` (number), `match` (glob), `as` (render shorthand)
- Renders ASCII directory tree using `├──` / `└──` / `│`
- Subject to filesystem confinement

**@date:**
- Syntax: `@date`, `@date format="YYYY-MM-DD"`, `@date file="./file.ts" type="modified"`
- Options:
  - `format`: date format string. Tokens: `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`
  - `file`: path to file for modified-time lookup
  - `type`: `current` (default) or `modified` -- `created` is NOT supported
- `type="created"` → parse error with message: "created is unreliable on Linux; use git log instead"
- Git creation date idiom: `@query "git log --follow --format=%aI --diff-filter=A -- ./file | tail -1"`
- Inline use: `{{ date format="YYYY" }}`

**@count:**
- Filesystem only -- counts files or directories matching a glob
- Options: `match` (glob), `type` (files/dirs/both, default files)
- Inline use: `{{ count ./src/ match="**/*.ts" }}`
- For counting JSON/CSV/DB results: pipe through `wc -l` instead
- `type="created"` does not exist on @count -- not applicable

## Known Issues
(none)
