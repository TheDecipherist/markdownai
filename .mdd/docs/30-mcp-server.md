---
id: 30-mcp-server
title: MCP Server — AI Integration
edition: Both
depends_on: [28-caching]
source_files:
  - packages/mcp/package.json
  - packages/mcp/tsconfig.json
  - packages/mcp/src/server.ts
  - packages/mcp/src/tools/read_file.ts
  - packages/mcp/src/tools/resolve_phase.ts
  - packages/mcp/src/tools/list_phases.ts
  - packages/mcp/src/tools/call_macro.ts
  - packages/mcp/src/tools/get_env.ts
  - packages/mcp/src/tools/next_phase.ts
  - packages/mcp/src/tools/execute_directive.ts
  - packages/mcp/src/tools/invalidate_cache.ts
  - packages/mcp/src/connections.ts
  - packages/mcp/index.ts
wave: markdownai-core-wave-4
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [mcp, server, ai-integration, phase-management, lazy-loading, tools, cache-invalidation]
path: Toolchain/MCP
integration_contracts:
  - caller_feature: 30-mcp-server
    function: validateMcpInput(params, schema)
    when: before every MCP tool dispatches user-supplied filePath, macroName, args, cwd, directive values
    mandatory: true
  - caller_feature: 30-mcp-server
    function: filterEnvKeys(key, allowedKeys)
    when: in get_env.ts before any process.env lookup
    mandatory: true
  - caller_feature: 30-mcp-server
    function: applyMasking(args, security)
    when: before storing connection args in connections singleton
    mandatory: true
satisfies_contracts:
  - from: 23-security-filesystem
    function: checkFilePath(resolved, ctx.jailRoot, ctx.security)
    when: before reading files in next_phase, list_phases, resolve_phase
    status: pending
  - from: 27-security-immutable-rules
    function: Object.freeze() on all rule arrays at definition
    when: in security/rules.ts — all exported arrays
    status: pending
known_issues: []
---

# 30 — MCP Server — AI Integration

## Purpose

MCP server that intercepts AI file reads for MarkdownAI documents. Enables lazy phase loading -- only the active phase's content is loaded into AI context at a time.

**Package:** `@markdownai/mcp` -- internal to monorepo.

## Business Rules

**Tools exposed:**

| Tool | Description |
|---|---|
| `read_file(path)` | Intercepts .md reads -- if @markdownai header, route through engine; else pass through |
| `resolve_phase(file, phase)` | Load and resolve a specific phase into AI context |
| `list_phases(file)` | Phase manifest from @on complete -> transitions. @graph for visualization only, never for sequencing. |
| `call_macro(file, macro, args?)` | Resolve named macro with param substitution |
| `get_env(key, fallback?)` | Resolve env var from server environment |
| `next_phase(file, current_phase)` | Next phase from @on complete -> declarations. @graph never consulted. |
| `execute_directive(directive)` | Execute single directive string, return output |
| `invalidate_cache(file?, directive?)` | Invalidate session cache entries. AI requests fresh data after known change without restarting. |

**Lazy loading:**
- 20-phase document never loads all 20 phases simultaneously
- AI calls `resolve_phase` for active phase, works through it, calls `next_phase`, loads next
- Completed phases never reloaded
- Context window only contains what is actively needed

**Connections:** MCP server establishes DB connections once at startup, reuses across all @db calls in session.

**`mai serve` command:**
```bash
mai serve
mai serve --cwd /path/to/project
mai serve --port 3000
```

## Known Issues
(none)
