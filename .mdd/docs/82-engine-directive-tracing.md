---
id: 82-engine-directive-tracing
title: Engine — Internal Directive Execution Tracing
edition: Both
depends_on: [03-engine, 81-lang-event, 22-security-config]
source_files:
  - packages/engine/src/trace/config.ts
  - packages/engine/src/trace/span.ts
  - packages/engine/src/trace/emit.ts
  - packages/engine/src/engine.ts
  - packages/engine/src/context.ts
  - packages/engine/src/index.ts
  - packages/engine/src/__tests__/trace.test.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/trace.test.ts
data_flow: greenfield
last_synced: 2026-05-22
status: complete
phase: complete
mdd_version: 1.8.7
tags: [tracing, telemetry, engine, instrumentation, developer-tools, performance, internal, diagnostics]
path: Engine/Tracing
integration_contracts: []
satisfies_contracts: []
known_issues: []
security_read_sites: []
---

# 82 — Engine — Internal Directive Execution Tracing

## Purpose

Internal telemetry for the MarkdownAI development team. When enabled via the `MARKDOWNAI_TRACE` environment variable, the engine emits a structured trace span for every directive execution — type, timing, arguments, output size, and error — to a configurable sink (stderr, file, or HTTP endpoint).

This is not a user-facing feature. Document authors cannot enable or configure it. It bypasses all user security gates. The MarkdownAI team uses it during development to profile rendering performance, debug unexpected behavior, and build a real data picture of how documents execute in the wild.

## Architecture

```
process.env.MARKDOWNAI_TRACE=file:/tmp/trace.jsonl  (or stderr, or http://...)
          |
          v
     execute() start
          |
     parseTraceConfig()  →  TraceConfig stored in ctx.traceConfig
          |
     walkNode(node, ctx)
          |
          ├─ ctx.traceConfig === null  →  walkNodeCore()  (zero overhead, direct call)
          |
          └─ ctx.traceConfig set:
               ├─ emitSpan(START span)
               ├─ walkNodeCore()  →  output string
               ├─ emitSpan(END span with duration + outputSize)  [or ERROR span on throw]
               └─ return output

     emitSpan()
          ├─ sink: stderr   →  process.stderr.write(JSON + '\n')     [sync]
          ├─ sink: file     →  fs.appendFile(path, JSON + '\n')      [async, fire-and-forget]
          └─ sink: http     →  fetch(url, { method: 'POST', body })  [async, fire-and-forget]
```

### Why separate from @event

User-authored `@event` directives go through the full security gate stack (`allowed_transports`, masking, length cap, onError handling). Internal tracing cannot be gated by the user security config — it needs to fire regardless of what the document author has configured. The two systems share the masking utility for args sanitization but have independent dispatch paths.

### TraceSpan shape

```typescript
interface TraceSpan {
  id: string                               // UUID per directive invocation
  runId: string                            // shared with EngineEvent.meta.runId
  type: string                             // AST node type: 'env', 'query', 'http', 'event', etc.
  status: 'start' | 'end' | 'error'
  timestamp: number                        // Date.now() when this record was emitted
  startedAt: number                        // when the directive began executing
  endedAt?: number                         // present on 'end' and 'error'
  duration?: number                        // ms, present on 'end' and 'error'
  document: string                         // source document path
  line: number                             // source line
  phase: string | null                     // active phase filter
  callstack: string[]                      // @phase/@call context path
  args: Record<string, string>             // key directive args, masked via applyMasking()
  outputSize?: number                      // output byte count, present on 'end'
  error?: string                           // error message, present on 'error'
  git: { hash: string; short: string } | null  // from ctx.gitMeta
  sessionId: string | null                 // from ctx.mcp?.sessionId
}
```

### TraceConfig shape

```typescript
interface TraceConfig {
  sink: 'stderr' | { type: 'file'; path: string } | { type: 'http'; url: string }
}
```

### MARKDOWNAI_TRACE env var format

| Value | Sink |
|-------|------|
| `true` or `1` or `stderr` | stderr (sync JSON-Lines) |
| `file:/tmp/trace.jsonl` | append to `/tmp/trace.jsonl` (async) |
| `http://localhost:4317/trace` | POST to endpoint (async) |

Unrecognized format: emit one warning to stderr and disable tracing for the run.

### EngineContext additions

```typescript
interface EngineContext {
  // ... existing fields ...
  traceConfig: TraceConfig | null   // null = tracing disabled (default)
}
```

`traceConfig` is initialized to `null` in `makeContext()`. The `execute()` function reads `process.env.MARKDOWNAI_TRACE` and sets it on the context if present. Sub-documents processed via `@include` inherit the same context and are automatically traced.

### Args extraction

A shared `extractArgs(node: ASTNode)` function reads common fields from each node type (`name`, `path`, `url`, `command`, `transport`, `query`, etc.) into a flat `Record<string, string>`. The result is run through `applyMasking()` before it reaches any span — secrets in directive arguments are replaced with `***MASKED***`.

## Business Rules

- **Off by default.** `MARKDOWNAI_TRACE` must be explicitly set. Any document that does not set this variable sees zero overhead — `!ctx.traceConfig` is checked once at the top of `walkNode`.
- **Bypasses user security gates.** The trace sink is not subject to `allowed_transports`, `allow_env_interpolation`, or any `EventSecurityConfig`. This is intentional — it is a developer instrument.
- **Args are always masked.** Even though the transport is unguarded, args values are run through `applyMasking()` before serialization. Secrets must not appear in trace logs.
- **Fire-and-forget for file and http.** The main rendering thread does not wait for the sink write. A trace write failure never surfaces to the caller.
- **Stderr is synchronous.** When `sink = stderr`, writes are synchronous so trace output appears in the correct order relative to other stderr output during development.
- **Every node type is traced.** `walkNode` covers all 24 directive types. Adding a new directive type automatically gets traced since the wrapper is at the switch level, not per-handler.
- **Spans are paired.** Every `start` span has a matching `end` or `error` span with the same `id`. If an error is thrown and caught by the engine (added to `result.errors`), the span status is `error` and the error message is included. Re-throws (FatalError) also emit error spans before propagating.

## Data Flow

Greenfield — no existing data flows modified. The only existing code touched is `walkNode` in `engine.ts` (wrapper added) and `makeContext()` / `EngineContext` in `context.ts` (new `traceConfig` field, initialized to `null`).

## Dependencies

- **03-engine** — `walkNode`, `EngineContext`, `makeContext()`, `execute()` — the tracing hooks live inside these.
- **81-lang-event** — `applyMasking()` from `packages/engine/src/security/masking.ts` is reused for args sanitization. The `runId` and `callstack` fields on `EngineContext` are reused in the span.
- **22-security-config** — The trace config explicitly bypasses `EventSecurityConfig`. This is documented as intentional and must be preserved in any security audit.

## Security

This feature is internal developer tooling. The security model is deliberately different from user-facing directives:

- **Trusted input only.** The `MARKDOWNAI_TRACE` env var is set by the MarkdownAI developer running the engine — not by document authors or MCP clients. It is read once at `execute()` start and never re-evaluated.
- **What a malicious caller could attempt.** A document author cannot set `MARKDOWNAI_TRACE` through any directive (env interpolation, @query, @http). The env var is read from `process.env` at execution start, before any document content is processed.
- **Args masking is the one hard gate.** Even though the transport bypasses security gates, `applyMasking()` runs on all args values before serialization. This ensures secrets from `@env`, `@db`, `@http` args do not appear in trace output.
- **Sink validation.** The `parseTraceConfig()` function validates the sink URL format before any write attempt. Invalid or malformed sink values disable tracing and emit one warning.

## Known Issues

None yet — populated by future audits.

## Bugs

(none yet — populated by /mdd bug when issues are reported)
