---
id: 29-stripper
title: Stripper — mai strip Command
edition: Both
depends_on: []
source_files:
  - packages/core/src/commands/strip.ts
  - packages/engine/src/stripper.ts
wave: markdownai-core-wave-4
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [stripper, strip, clean-markdown, removal-rules, conditional-stripping, mai-strip]
path: Toolchain/Stripper
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 29 — Stripper — mai strip Command

## Purpose

Removes all MarkdownAI syntax, producing clean vanilla markdown safe for commit, export, or rendering in standard markdown viewers. Never executes directives -- syntax removal only.

## Business Rules

**Stripper node removal rules:**

| Node type | Stripper behavior |
|---|---|
| `header` | Removed |
| `include` | Removed -- file inlining is renderer concern |
| `import` | Removed -- definition registration is engine concern |
| `env` | Removed |
| `define` | Removed (entire block including body) |
| `call` | Removed |
| `connect` | Removed |
| `phase` | Body kept, @phase/@end tags removed |
| `transition` | Removed |
| `list`, `read`, `query`, `db`, `http`, `tree`, `date`, `count` | Removed |
| `render` | Removed |
| `pipe` | Removed (entire pipe chain) |
| `conditional` | Evaluated against current env -- matching branch rendered, other branches removed, directive tags removed |
| `graph` | Passed through unchanged (documentation) |
| `markdown` | Passed through unchanged |
| `passthrough` | Passed through unchanged |
| `interpolation` | Evaluated if possible, else removed |

**Conditional stripping behavior (critical):**
- Without `--env`: all unset vars → empty string → false → @else branches render
- WARN logged per unset variable referencing @if conditions
- Always use `--env .env.production` for conditional documents
- `mai validate` reports all unset vars before stripping

**`mai strip` command:**
```bash
mai strip input.md
mai strip input.md --env .env.production -o output.md
mai strip ./docs/ --env .env.production -o ./dist/
```

**What the stripper never does:** execute directives, register definitions, read files, make network requests.

## Known Issues
(none)
