---
id: 41-mcp-e2e-protocol
title: MCP E2E — Protocol Conformance
edition: Both
depends_on: [30-mcp-server, 33-e2e-test-suite]
source_files:
  - e2e/mcp-fixtures/multi-phase.md
  - e2e/mcp-fixtures/phases/phase-1.md
  - e2e/mcp-fixtures/phases/phase-2.md
  - e2e/mcp-fixtures/phases/phase-3.md
  - e2e/mcp-fixtures/with-macros.md
  - e2e/e2e-mcp-protocol.test.ts
routes: []
models: []
test_files:
  - e2e/e2e-mcp-protocol.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [mcp, e2e, protocol, json-rpc, conformance, handshake, subprocess, tools-list]
path: Testing/MCP-E2E
wave: markdownai-mcp-e2e-wave-1
wave_status: planned
initiative: markdownai-mcp-e2e
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 41 — MCP E2E — Protocol Conformance

## Purpose

Tests the MCP server's JSON-RPC protocol layer in isolation from tool correctness. Spawns `mai serve` as a subprocess, drives it via stdin/stdout, and asserts: the handshake sequence completes correctly, `tools/list` returns a well-formed schema for all 8 tools, `tools/call` dispatches correctly, and all error paths return proper JSON-RPC error objects (not crashes, not plain strings).

## Architecture

```
test helpers:
  spawnMcpServer()   → ChildProcess with stdin/stdout piped
  sendRpc(proc, req) → writes JSON + newline to stdin, reads response line from stdout
  rpcCall(proc, method, params) → wraps sendRpc with request id tracking

fixtures:
  e2e/mcp-fixtures/multi-phase.md   → used for phase tool protocol tests
  e2e/mcp-fixtures/with-macros.md   → used for macro tool protocol tests

test file: e2e/e2e-mcp-protocol.test.ts
```

The subprocess approach is used throughout — this tests the full stack including the server process launch, stdin/stdout framing, and JSON-RPC line parsing. No internal imports from `@markdownai/mcp` in this feature (those are for unit tests, not e2e).

## Data Model

**JSON-RPC request shape:**
```typescript
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params: Record<string, unknown>
}
```

**JSON-RPC response shape:**
```typescript
interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}
```

**`sendRpc` contract:** writes one JSON line to stdin, reads one JSON line from stdout. Responses are newline-delimited. A 5-second timeout per call — if no response arrives, the test fails with "MCP server did not respond".

## Business Rules

### Fixture: `multi-phase.md`

A MarkdownAI document with 3 phases and `@on complete ->` transition declarations. Each phase includes `@include ./phases/phase-<N>.md` for content. Used to test all phase tools via the protocol layer.

```markdown
@markdownai

# Multi-Phase Project

@phase setup
@include ./phases/phase-1.md
@on complete -> implementation
@end

@phase implementation
@include ./phases/phase-2.md
@on complete -> review
@end

@phase review
@include ./phases/phase-3.md
@end
```

Each `phases/phase-N.md` contains distinguishable prose and at least one `@define` macro.

### Fixture: `with-macros.md`

A MarkdownAI document with 2 named macros. Used to test `call_macro` and `list_macros` via the protocol layer.

### Protocol Tests

**Handshake:**
- Send `initialize` → response contains `protocolVersion`, `capabilities.tools`, `serverInfo.name === "markdownai"`
- Send `notifications/initialized` → no response (notification, not a request)
- Any method sent before `initialize` completes → `JSON-RPC error -32600` (invalid request)

**`tools/list`:**
- Response contains `tools` array with exactly 8 entries (or 9 if get_constraints is implemented)
- Each tool has: `name` (string), `description` (string), `inputSchema` (JSON Schema object)
- Tool names present: `read_file`, `resolve_phase`, `list_phases`, `call_macro`, `get_env`, `next_phase`, `execute_directive`, `invalidate_cache`
- `inputSchema` for each tool has at minimum a `properties` object and `required` array

**Error handling:**
- `tools/call` with unknown tool name → `JSON-RPC error -32601` (method not found) or well-formed result error — not a crash
- `tools/call` with missing required params → `JSON-RPC error -32602` (invalid params) or well-formed result error
- Malformed JSON on stdin → server stays alive and responds to the next valid request (resilient)
- `initialize` called twice → server handles gracefully (no crash)

**Subprocess lifecycle:**
- Server exits cleanly when stdin closes (no zombie processes)
- `beforeAll`: spawn server, complete handshake, write fixture files to temp dir
- `afterAll`: close stdin, wait for process to exit, assert exit code 0

## Data Flow

Greenfield. All communication via subprocess stdin/stdout — no internal imports from MCP package.

## Dependencies

- **30-mcp-server** — the subprocess being tested.
- **33-e2e-test-suite** — follows the same `e2e/` workspace pattern; added to the same npm workspace.

## Security

Test-only subprocess interaction. No production security concerns.

## Known Issues

(none)
