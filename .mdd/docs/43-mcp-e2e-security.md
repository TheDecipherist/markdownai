---
id: 43-mcp-e2e-security
title: MCP E2E — Security Enforcement at MCP Boundary
edition: Both
depends_on: [22-security-config, 23-security-filesystem, 27-security-immutable-rules, 42-mcp-e2e-tools]
source_files:
  - e2e/e2e-mcp-security.test.ts
routes: []
models: []
test_files:
  - e2e/e2e-mcp-security.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [mcp, e2e, security, path-traversal, credential-filtering, immutable-rules, jail, boundary]
path: Testing/MCP-E2E
wave: markdownai-mcp-e2e-wave-2
wave_status: planned
initiative: markdownai-mcp-e2e
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 43 — MCP E2E — Security Enforcement at MCP Boundary

## Purpose

Verifies that the security enforcement functions wired in Wave 3 actually fire when called through the MCP interface. The audit found that `checkFilePath`, `filterEnvKeys`, and input sanitization were required but potentially unwired. This test suite proves they work from Claude's perspective — a malicious or misconfigured call cannot traverse paths, expose credentials, or inject directives through the MCP layer.

## Architecture

```
e2e/e2e-mcp-security.test.ts
  imports: { spawnMcpServer, rpcCall } from './helpers/mcp-helpers.js'
  uses: temp dir fixtures created inline (not reusing mcp-fixtures/)
```

All attack vectors are tested via the subprocess JSON-RPC interface — the same path a real malicious MCP caller would use.

## Business Rules

### Path Traversal — `read_file`

- `read_file({ path: "../../../etc/passwd" })` → error response, content NOT returned
- `read_file({ path: "/etc/passwd" })` → error response (absolute path outside jailRoot blocked)
- `read_file({ path: "../../packages/core/src/cli.ts" })` → error response (traversal beyond document root blocked)
- After each blocked call: server remains alive and responds to the next valid request (no crash on attack)

### Path Traversal — `resolve_phase`

- `resolve_phase({ file: "../../../etc/shadow", phase: "any" })` → error response
- `resolve_phase({ file: "/absolute/path/outside/project" })` → error response

### Credential Filtering — `get_env`

Test each known sensitive key pattern:
- `get_env({ key: "MONGO_PASSWORD" })` → empty string or error, not the actual value
- `get_env({ key: "AWS_SECRET_ACCESS_KEY" })` → blocked
- `get_env({ key: "DATABASE_URL" })` → blocked (contains connection string with credentials)
- `get_env({ key: "API_KEY" })` → blocked
- `get_env({ key: "NODE_ENV" })` → returned (safe, non-credential key)
- `get_env({ key: "PATH" })` → returned (safe)

After each blocked `get_env`: the actual credential value must not appear anywhere in the response, including `error.data`.

### Input Sanitization — `execute_directive`

- `execute_directive({ directive: "'; process.exit(1); //" })` → blocked or sanitized, server stays alive
- `execute_directive({ directive: "@read ../../../../etc/passwd" })` → error (path traversal via directive)
- `execute_directive({ directive: "@env MONGO_PASSWORD" })` → filtered (credential key)
- `execute_directive({ directive: "" })` → well-formed error (empty input)
- `execute_directive({ directive: null })` → well-formed error (null input)

### Input Sanitization — `call_macro`

- `call_macro({ file: "../../escape.md", macro: "name" })` → error (file path traversal)
- `call_macro({ file: "<valid-fixture>", macro: "'; DROP TABLE--" })` → error or sanitized result, no crash
- `call_macro({ file: "<valid-fixture>", macro: "", args: null })` → well-formed error

### Immutable Rules — Verify Rules Cannot Be Overridden

- Send `execute_directive` with a directive that would normally be blocked by immutable rules (cloud metadata endpoint access, `eval()` usage)
- Assert the rule fires and blocks — the immutable rules apply even via MCP

### Server Resilience

After every attack vector test, send a valid `tools/call` for `get_env({ key: "PATH" })` and assert it succeeds. The server must never crash or hang due to a malicious input.

## Data Flow

Greenfield. Attack fixtures created inline in the test using temp directories.

## Dependencies

- **22-security-config** — the security enforcement configuration.
- **23-security-filesystem** — `checkFilePath` is what blocks traversal.
- **27-security-immutable-rules** — the always-block rules verified via MCP.
- **42-mcp-e2e-tools** — shares `spawnMcpServer` / `rpcCall` helpers.

## Security

This is the security test suite — it intentionally sends attack payloads. All payloads are confined to the test environment. No real credentials are used.

## Known Issues

(none)
