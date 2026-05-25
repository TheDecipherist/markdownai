---
id: 92-lang-allowed-function
title: "allowed() - Expression Allow-List Helper"
edition: MarkdownAI
depends_on: [03-engine, 06-lang-interpolation, 12-lang-conditionals, 47-skill-context-variables]
relates: [83-lang-foreach-set, 50-match-operator]
source_files:
  - packages/engine/src/conditions.ts
  - packages/engine/src/engine-interpolate.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/conditions.test.ts
data_flow: greenfield
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [expression-system, sandbox, helper-function, allow-list, validation, dynamic-variables]
path: Language/Expressions
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
sister_projects: []
---

# 92 - allowed() - Expression Allow-List Helper

## Purpose

Adds an `allowed(value, allowedValues, options?)` built-in function to the expression sandbox. When the value is in the allow-list it returns the value itself; when it is not, it returns `false`. This lets the existing `||` default pattern act as the fallback — keeping expressions concise without introducing new syntax.

## Architecture

`allowed()` is a plain function injected into the sandbox object in two places:

- `buildSandbox()` in `packages/engine/src/conditions.ts` — used by `@if`, `@switch`, `@case`, and any directive that calls `evalCondition()` or `evalExpression()`
- The inline sandbox in `packages/engine/src/engine-interpolate.ts` — used by all `{{ }}` interpolations, including paths in `@include` and `@import`

The function itself is defined once (in `conditions.ts`) and exported so `engine-interpolate.ts` imports it directly — no duplication.

```
expression source
      │
      ▼
preprocessExpr()        ← unchanged
      │
      ▼
vm.runInNewContext(expr, sandbox)
      │                  sandbox now includes:
      │                    allowed(value, allowedValues, opts?)
      │                    file, env, argsList, arg0..3, ...
      ▼
result
```

## Data Model

No database storage. No persistent state.

## API Endpoints

None.

## Business Rules

### Signature

```
allowed(value, allowedValues, options?)
  value         — any value; typically a string from argsList[0] or an env var
  allowedValues — string | string[] | any[]  (single value or array)
  options       — optional object: { ignoreCase?: boolean }
```

### Return value

- Returns `value` (the original, unchanged) when it matches the allow-list.
- Returns `false` when it does not match, or when `allowedValues` is not a string, array, or recognisable type.

Returning the value (not `true`) keeps the `||` default pattern working: `{{ allowed(argsList[0], ["a","b"]) || "default" }}` outputs the actual matched value, not the string `"true"`.

### Normalization rules

1. If `allowedValues` is a non-array value (string, number, etc.), wrap it in a single-element array before comparing: `allowed(x, "audit")` behaves identically to `allowed(x, ["audit"])`.
2. If `allowedValues` is not an array and not a primitive (e.g. `null`, `undefined`, an object), return `false` immediately — do not throw.
3. If `options.ignoreCase` is `true` and both `value` and the list entries are strings, comparison is case-insensitive. The original `value` casing is preserved in the return.

### @set variable support

`allowed()` accepts any value for both arguments. If `allowedValues` is a variable set via `@set`, it resolves through the sandbox before `allowed()` is called. The function itself has no awareness of `@set` — it sees whatever the sandbox resolved the variable to. Full `@set` → sandbox wiring is feature 83's responsibility.

### Edge cases

| Input | Behaviour |
|---|---|
| `allowed("audit", ["audit","build"])` | returns `"audit"` |
| `allowed("invalid", ["audit","build"])` | returns `false` |
| `allowed("audit", "audit")` | returns `"audit"` (single-value normalised to array) |
| `allowed("AUDIT", ["audit"], {ignoreCase:true})` | returns `"AUDIT"` |
| `allowed("x", null)` | returns `false` (bad input, safe) |
| `allowed("x", 42)` | returns `false` (bad input, safe) |
| `allowed(undefined, ["a"])` | returns `false` |

## Data Flow

Greenfield. No existing data flows modified. The function is injected into the sandbox at construction time and never reads or writes external state.

## Dependencies

- `03-engine` — `EngineContext`, `buildSandbox()`, `runExpr()` infrastructure
- `06-lang-interpolation` — `{{ }}` spans evaluated through `evalExpr()` in `engine-interpolate.ts`
- `12-lang-conditionals` — condition evaluation calls `buildSandbox()`, which gains `allowed()`
- `47-skill-context-variables` — `argsList` is the primary source of `value` in practice

## Security

`allowed()` accepts external/user input (the `value` argument comes from `argsList` which is user-supplied). However:

- The comparison is a pure in-memory array lookup — no filesystem, network, or process access.
- `allowedValues` is authored in the document by the document owner, not supplied by an external caller.
- A malicious caller can only supply `value`. The worst outcome is that `value` is not in the list and `allowed()` returns `false`, triggering the `||` default. There is no escalation path.
- No exceptions are thrown regardless of input — all bad-input paths return `false`.

## Known Issues

(none)

## Bugs

(none yet - populated by /mdd bug when issues are reported)
