---
id: markdownai-mcp-e2e
title: MarkdownAI — MCP Server E2E Tests
status: active
version: 1
hash: 02d16c27
created: 2026-05-16
---

# MarkdownAI — MCP Server E2E Tests

## Overview

End-to-end verification of the MCP server from Claude's perspective. The CLI e2e suite (33-e2e-test-suite) confirmed that `mai render`, `mai strip`, and `mai validate` work correctly. This initiative confirms that the MCP server — the layer Claude actually uses in production — speaks the JSON-RPC protocol correctly, all 8 tools work end-to-end with real documents, security enforcement fires at the MCP boundary, and AI-native features (format=ai default, get_constraints) work as Claude would experience them.

Tests are written from the perspective of a Claude session interacting with a MarkdownAI project: spawn the server, send JSON-RPC messages, assert responses.

## Open Product Questions

(none — scope fully defined by the 8 existing tools + AI-native defaults)

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/markdownai-mcp-e2e-wave-1.md | All 8 MCP tools return correct JSON-RPC responses; protocol handshake works; error responses are well-formed | planned |
| Wave 2 | waves/markdownai-mcp-e2e-wave-2.md | Security enforcement verified at MCP boundary; ai-format default confirmed; get_constraints tool works; realistic multi-turn phase workflow passes | planned |
