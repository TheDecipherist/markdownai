---
id: 08-lang-macros
title: Language — @define and @call Macros
edition: Both
depends_on: [07-lang-env]
source_files:
  - packages/parser/src/directives/define.ts
  - packages/parser/src/directives/call.ts
  - packages/engine/src/macros.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [macros, define, call, parameters, local-scope, reusable-blocks]
path: Language/Macros
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 08 — Language — @define and @call Macros

## Purpose

`@define` creates named reusable blocks. `@call` invokes them with optional parameter substitution. Macros can contain any directive including dynamic ones.

## Business Rules

**@define grammar (four valid forms):**
```
@define name                          -- no params, global scope
@define name @local                   -- no params, local scope
@define name(param1, param2)          -- with params, global scope
@define name(param1, param2) @local   -- with params, local scope
```
- `@local` is always the last token if present -- parser extracts it before parsing name/params
- Parameters are inside `()`, `@local` is outside -- no ambiguity
- Parameter names never start with `@`
- Block ends with `@end`
- Not rendered at definition -- only when called

**@call grammar:**
```
@call name
@call name(arg1, arg2)
@call name(key=value, key2=value2)
```

**Parameter resolution:**
- Unspecified parameters resolve to empty string -- never an error
- `{{ param || "default" }}` inside macro body is the idiom for meaningful defaults
- Parameters are substituted before executing the macro body

**Scope (@local):**
- Without `@local`: macro bubbles up to parent scope, available to all sibling files included after
- With `@local`: stays within the defining file and its children only, not added to shared registry
- Macros defined in root document available to all phases via MCP macro registry

## Known Issues
(none)
