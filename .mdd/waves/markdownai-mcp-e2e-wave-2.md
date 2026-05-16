---
id: markdownai-mcp-e2e-wave-2
title: "Wave 2: MCP Security Enforcement and AI-Native Integration"
initiative: markdownai-mcp-e2e
initiative_version: 1
status: planned
depends_on: markdownai-mcp-e2e-wave-1
demo_state: "Path traversal in read_file is blocked with a JSON-RPC error. process.env credential keys are filtered in get_env. Calling render_document via MCP returns ai-format output by default without any format flag. get_constraints returns the constraint registry from a document using @constraint. A realistic multi-turn Claude workflow — initialize, list phases, resolve each phase in sequence, call macros, invalidate cache — completes without error."
created: 2026-05-16
hash: 73243231
---

# Wave 2: MCP Security Enforcement and AI-Native Integration

## Demo-State

Security gates fire at the MCP boundary. AI defaults are confirmed. A full realistic Claude session — the kind that actually runs when Claude Code opens a MarkdownAI project — passes end-to-end.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | mcp-e2e-security | .mdd/docs/43-mcp-e2e-security.md | planned | — |
| 2 | mcp-e2e-ai-integration | .mdd/docs/44-mcp-e2e-ai-integration.md | planned | mcp-e2e-security |

## Open Research

(none)
