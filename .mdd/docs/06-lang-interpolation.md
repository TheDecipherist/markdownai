---
id: 06-lang-interpolation
title: Language — Inline Interpolation {{ }}
edition: Both
depends_on: [01-parser]
source_files:
  - packages/parser/src/directives/interpolation.ts
  - packages/engine/src/conditions.ts
wave: markdownai-core-wave-2
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [interpolation, expressions, inline, template, env-vars, ternary, optional-chaining]
path: Language/Interpolation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 06 — Language — Inline Interpolation {{ }}

## Purpose

`{{ expression }}` allows any expression to be embedded inline in prose. Distinct from directives -- operates inside existing text rather than on its own line.

## Business Rules

- Syntax: `{{ expression }}` -- double curly braces, any valid expression inside
- Immune inside fenced code blocks (triple backtick) and inline backtick spans
- `\{{` is a literal escape -- renders as `{{` in output
- Valid expressions: `env.VAR`, `date format="YYYY"`, `count ./src/ match="*.ts"`, `read ./package.json path="version"`, `file.exists "./path"` and all expression operators
- Ternary: `{{ file.exists "./config/prod.json" ? "production" : "development" }}`
- Nullish: `{{ env.API_URL ?? "http://localhost:3000" }}`
- Optional chain: `{{ env.COMPANY?.name }}`
- Expression evaluation uses the same engine as `@if` conditions -- one expression system
- Unresolvable expression → empty string, WARN logged
- The parser tokenizes `{{ }}` as `interpolation` nodes inline within `markdown` nodes

## Known Issues
(none)
