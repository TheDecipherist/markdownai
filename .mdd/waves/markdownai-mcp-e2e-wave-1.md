---
id: markdownai-mcp-e2e-wave-1
title: "Wave 1: MCP Protocol Conformance and Tool Accuracy"
initiative: markdownai-mcp-e2e
initiative_version: 1
status: planned
depends_on: markdownai-core-wave-4
demo_state: "Spawn `mai serve`, send JSON-RPC initialize → tools/list → tools/call for each of the 8 tools against real fixtures, receive correct responses. Protocol errors return well-formed JSON-RPC error objects. Phase workflow (list_phases → resolve_phase → next_phase) advances correctly through a multi-phase document."
created: 2026-05-16
hash: 7f9a57de
---

# Wave 1: MCP Protocol Conformance and Tool Accuracy

## Demo-State

Spawn `mai serve`, complete a full JSON-RPC session: `initialize` → `notifications/initialized` → `tools/list` → `tools/call` for all 8 tools. Each tool returns a correct, well-formed result. Phase workflow traverses a multi-phase document from phase 1 to completion. Error cases return JSON-RPC error objects with correct codes, not crashes.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | mcp-e2e-protocol | .mdd/docs/41-mcp-e2e-protocol.md | planned | — |
| 2 | mcp-e2e-tools | .mdd/docs/42-mcp-e2e-tools.md | planned | mcp-e2e-protocol |

## Open Research

(none)
