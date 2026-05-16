---
id: 13-lang-pipeline
title: Language — Pipe Operator and @render
edition: Both
depends_on: []
source_files:
  - packages/parser/src/directives/render.ts
  - packages/parser/src/directives/pipe.ts
  - packages/engine/src/pipe.ts
  - packages/renderer/src/renderer.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [pipeline, pipe, render, output, ascii-charts, cross-platform, builtins]
path: Language/Pipeline
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 13 — Language — Pipe Operator and @render

## Purpose

The pipe operator connects source directives to transform commands to the @render sink. Follows Unix philosophy -- plain text, one item per line, composable.

## Business Rules

**Pipe parsing:**
- Any directive line with an unquoted `|` → parsed as single `pipe` node
- `|` inside `"..."` is never a pipe separator -- split on unquoted `|` only
- Explicit parser exception to one-directive-per-line rule
- Stages: source → [builtin | shell]* → [render | scalar]

**@render:**
- Only valid as last stage of pipe chain -- NEVER standalone
- `@render type="list|numbered|links|table|code|inline|bar|flow|tree|timeline|json"`
- `as="type"` shorthand on source directives = appends `| @render type="type"`

**Built-in pipe commands (cross-platform Node.js implementations):**
- `grep <pattern>`, `grep -v <pattern>`, `grep -i <pattern>`
- `sort`, `sort -r`, `sort -n`, `sort -rn`
- `head -n N`, `tail -n N`
- `wc -l` (returns number string)
- `uniq`
These never spawn processes -- pure Node.js. Work on all platforms including Windows.

**Shell-dependent commands (Unix/WSL only):**
- `awk`, `sed`, `cut`, `xargs`, `tr`, `jq`, and all other shell utilities
- On Windows without WSL: stripped with WARN, never crash
- `mai validate` warns when shell commands detected and platform is Windows

**Pipe into scalar:**
- Final stage is a command (not @render) → output is scalar string, inlined directly
- Example: `@list ./src/ | wc -l` → bare number

## Known Issues
(none)
