---
id: 42-mcp-e2e-tools
title: MCP E2E — All 8 Tools End-to-End
edition: Both
depends_on: [30-mcp-server, 41-mcp-e2e-protocol]
source_files:
  - e2e/e2e-mcp-tools.test.ts
routes: []
models: []
test_files:
  - e2e/e2e-mcp-tools.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [mcp, e2e, tools, read-file, resolve-phase, list-phases, call-macro, get-env, next-phase, execute-directive, invalidate-cache]
path: Testing/MCP-E2E
wave: markdownai-mcp-e2e-wave-1
wave_status: planned
initiative: markdownai-mcp-e2e
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 42 — MCP E2E — All 8 Tools End-to-End

## Purpose

Tests each of the 8 MCP tools for correctness, using the shared `spawnMcpServer`/`sendRpc` helpers from `41-mcp-e2e-protocol` and the fixtures created there. Each tool is tested: happy path (correct inputs → correct output), at least one edge case, and one invalid-input case. The phase tools are also tested in sequence — the realistic `list_phases → resolve_phase → next_phase → resolve_phase → …` workflow a Claude session would follow.

## Architecture

```
e2e/e2e-mcp-tools.test.ts
  imports: { spawnMcpServer, sendRpc, rpcCall } from './helpers/mcp-helpers.js'
  fixtures: reuses e2e/mcp-fixtures/ from 41-mcp-e2e-protocol
```

A shared `helpers/mcp-helpers.ts` module is created alongside the test files — it exports the spawn/send helpers so both protocol and tool tests use identical infrastructure.

## Business Rules

### Tool: `read_file`

- Happy path: `read_file({ path: "<mcp-fixture/multi-phase.md>" })` → result contains rendered markdown, no unresolved `@phase` blocks, no raw directive tokens
- Non-MarkdownAI file: `read_file({ path: "<some .txt file>" })` → raw file content passed through unchanged
- Missing file: `read_file({ path: "does-not-exist.md" })` → well-formed error result (not crash)

### Tool: `list_phases`

- `list_phases({ file: "<multi-phase.md>" })` → result contains array with 3 phase entries
- Each entry has: `name` (string), `transitions` (array)
- `setup` → transitions to `["implementation"]`, `implementation` → `["review"]`, `review` → `[]`
- Non-phased document → returns empty array, exitCode 0

### Tool: `resolve_phase`

- `resolve_phase({ file: "<multi-phase.md>", phase: "setup" })` → result contains rendered content of phase-1.md (the included file)
- `resolve_phase({ file: "<multi-phase.md>", phase: "nonexistent" })` → well-formed error result
- Content from `@include` inside the phase is expanded (not raw `@include` tokens)

### Tool: `next_phase`

- `next_phase({ file: "<multi-phase.md>", current_phase: "setup" })` → `"implementation"`
- `next_phase({ file: "<multi-phase.md>", current_phase: "implementation" })` → `"review"`
- `next_phase({ file: "<multi-phase.md>", current_phase: "review" })` → `null` (no next phase)
- `next_phase({ file: "<multi-phase.md>", current_phase: "nonexistent" })` → well-formed error

### Tool: `call_macro`

- `call_macro({ file: "<with-macros.md>", macro: "<defined-macro-name>", args: {} })` → rendered macro output
- `call_macro({ file: "<with-macros.md>", macro: "<macro-with-params>", args: { param1: "value" } })` → output with parameter substituted
- `call_macro({ file: "<with-macros.md>", macro: "undefined-macro" })` → well-formed error

### Tool: `get_env`

- `get_env({ key: "PATH" })` → non-empty string (PATH is always set)
- `get_env({ key: "DEFINITELY_NOT_SET_XYZ", fallback: "default-val" })` → `"default-val"`
- `get_env({ key: "DEFINITELY_NOT_SET_XYZ" })` → empty string or well-formed error (no crash)
- `get_env({ key: "MONGO_PASSWORD" })` → filtered (returns empty or error — credential key blocked)

### Tool: `execute_directive`

- `execute_directive({ directive: "@date format=\"YYYY\"" })` → string containing `"2026"`
- `execute_directive({ directive: "@env MARKDOWNAI_ENV fallback=\"test\"" })` → `"test"` (var not set in test env)
- `execute_directive({ directive: "@list ./nonexistent" })` → well-formed error (path does not exist)
- `execute_directive({ directive: "eval('process.exit(1)')" })` → blocked / well-formed error (not a valid directive)

### Tool: `invalidate_cache`

- Render a document with `@date @cache mode="session"` twice — results are equal (cached)
- `invalidate_cache({ file: "<the-file>" })` → `{ cleared: true }`
- Render the same document again after invalidation — result may differ (cache was cleared)
- `invalidate_cache({})` (no file) → clears all session cache, returns count ≥ 0

### Phase Workflow Integration Test

Simulates a real Claude session traversing all 3 phases of `multi-phase.md`:

```
list_phases(multi-phase.md)
  → [setup, implementation, review]
resolve_phase(multi-phase.md, "setup")
  → phase 1 content rendered correctly
next_phase(multi-phase.md, "setup")
  → "implementation"
resolve_phase(multi-phase.md, "implementation")
  → phase 2 content rendered correctly
next_phase(multi-phase.md, "implementation")
  → "review"
resolve_phase(multi-phase.md, "review")
  → phase 3 content rendered correctly
next_phase(multi-phase.md, "review")
  → null (end of document)
```

All steps pass with exitCode 0 and non-empty rendered output at each phase.

## Data Flow

Greenfield. Reuses fixtures and helpers from `41-mcp-e2e-protocol`.

## Dependencies

- **30-mcp-server** — all 8 tools under test.
- **41-mcp-e2e-protocol** — shared spawn/send helpers and fixtures.

## Security

Test-only. The `get_env` credential-key filtering test (MONGO_PASSWORD) is intentionally verifying the security gate fires — the test asserts the value is NOT returned.

## Known Issues

(none)
