---
id: markdownai-core
title: MarkdownAI Core
status: active
version: 1
hash:
created: 2026-05-14
---

# MarkdownAI Core

## Overview

MarkdownAI is a superset of markdown that makes documents live. It connects to filesystems, databases, APIs, and shells to render real data at the point it is needed. Files use the `.md` extension and are valid standard markdown -- standard renderers display directives as plain text (graceful degradation). The MarkdownAI toolchain renders them as live data.

Tagline: "documentation that cannot lie."

Six packages in an npm workspaces monorepo under the `@markdownai` npm org:

- `@markdownai/parser` -- lexer + AST + directive registry
- `@markdownai/renderer` -- 11 output format modules (list, table, bar, flow, tree, timeline, json, etc.)
- `@markdownai/engine` -- template execution, macro expansion, env resolution, pipe runner, cache
- `@markdownai/stripper` -- removes directives for safe export/commit
- `@markdownai/mcp` -- MCP server, lazy phase loading, AI integration tools
- `@markdownai/core` -- CLI binary `mai`, orchestrates all packages

The full language spec lives at: `MDs/markdownai-spec-v1.0.md` (reference this throughout).

## Open Product Questions

(none -- spec is complete)

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/markdownai-core-wave-1.md | `mai render input.md` produces output. `mai validate input.md` reports errors. | complete |
| Wave 2 | waves/markdownai-core-wave-2.md | Every directive renders correctly. All language features work end to end. | complete |
| Wave 3 | waves/markdownai-core-wave-3.md | Jailed directives strip by default. Security config controls execution. Masking fires on sensitive file reads. | complete |
| Wave 4 | waves/markdownai-core-wave-4.md | `mai strip` produces clean markdown. MCP server starts and intercepts AI reads. All CLI commands functional. `@cache` works. | planned |
