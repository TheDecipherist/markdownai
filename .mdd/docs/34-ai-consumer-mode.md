---
id: 34-ai-consumer-mode
title: AI — Consumer-Targeted Conditional Rendering
edition: Both
depends_on: [12-lang-conditionals, 04-cli-core]
source_files:
  - packages/engine/src/conditions.ts
  - packages/core/src/commands/render.ts
  - packages/core/src/commands/build.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/consumer-mode.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [consumer, ai, conditional, rendering, context-variable, human, audience]
path: AI/ConsumerMode
wave: markdownai-ai-native-wave-5
wave_status: planned
initiative: markdownai-ai-native
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 34 — AI — Consumer-Targeted Conditional Rendering

## Purpose

Adds `consumer` as a first-class runtime context variable in the MarkdownAI expression system. Authors write `@if consumer="ai"` or `@if consumer="human"` to produce audience-specific content from a single source document. The render command gains a `--consumer <value>` flag that injects the value into all expression evaluations.

## Architecture

```
render.ts  →  --consumer flag parsed  →  passed into EngineContext as ctx.consumer
conditions.ts  →  extends evaluateExpr  →  consumer variable available as ctx variable
@if consumer="ai"  →  evaluates as boolean  →  same gate as env.X == "y"
```

Consumer is a plain string variable injected at render time — no new parser node needed. The existing `@if` parser handles the syntax unchanged; only the evaluation context changes.

## Data Model

No storage. `consumer` is a render-time context variable only.

```typescript
interface EngineContext {
  // existing fields...
  consumer?: string   // injected from --consumer flag, defaults to undefined
}
```

When `consumer` is `undefined` (no flag passed), `@if consumer="ai"` evaluates to `false` — same behavior as an unset env var. This means untagged renders show neither branch, letting authors add `@else` for the "no-consumer-flag" case, or use `@if consumer="human" || consumer==""`  for a safe default.

## Business Rules

**`--consumer` flag:**
- `mai render <file> --consumer=ai` — injects `"ai"` as the consumer value
- `mai render <file> --consumer=human` — injects `"human"`
- Any string value is valid — the flag is not restricted to `ai` or `human`
- When not set: `consumer` is `undefined`; any `@if consumer="x"` evaluates to `false`

**Expression syntax (uses existing expression system — no new operators):**
```
@if consumer="ai"
...ai-optimized content...
@endif

@if consumer="human"
...human-optimized content...
@else
...fallback when consumer not set...
@endif

@if consumer="ai" || consumer="claude"
...for any AI consumer...
@endif
```

**Scope:** `consumer` is available everywhere the expression system is used — `@if`, `where` clauses, interpolation `{{ consumer }}`. It is not an env var and does not appear in `process.env`.

**Stripper behavior:** `mai strip` has no `--consumer` flag — stripping removes all directives including `@if` blocks. If a document has consumer-targeted blocks, render it first with the desired consumer, then strip the result.

**`mai validate` behavior:** `mai validate` reports all `@if consumer=` references that have no `--consumer` passed, with WARN (not error) — same treatment as unset env vars.

**MCP server:** the MCP `render_document` tool accepts an optional `consumer` parameter (default: `"ai"` — the MCP caller is always an AI).

## Data Flow

Greenfield — no existing data flows modified. Consumer variable follows the same path as `env.*` variables through the expression evaluator.

## Dependencies

- **12-lang-conditionals** — `conditions.ts` is the file this feature modifies. The `consumer` variable is injected into the same evaluation context as `env.*`.
- **04-cli-core** — `render.ts` gains the `--consumer` flag. The value flows through to `EngineContext`.

## Security

`consumer` is a CLI-provided string. It is never executed or evaluated as code — it is compared as a string literal in `@if` expressions via `vm.runInNewContext`. No sanitization needed beyond what the expression evaluator already provides. A malicious caller cannot use `consumer` to inject code because it is passed as a context variable value, not as expression source.

## Known Issues

(none)
