---
id: 31-hook
title: Hook — PreToolUse AI Routing
edition: Both
depends_on: [30-mcp-server]
source_files:
  - packages/core/src/hook.ts
  - packages/core/src/commands/init.ts
wave: markdownai-core-wave-4
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [hook, preToolUse, routing, detection, invisible-runtime, mai-init]
path: Toolchain/Hook
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 31 — Hook — PreToolUse AI Routing

## Purpose

A PreToolUse hook (~50 lines) that intercepts AI file reads for .md files and routes MarkdownAI documents through the MCP server. Invisible to the AI -- it always gets resolved content.

## Business Rules

**Hook logic:**
1. Is this a .md file read? If no → pass through immediately
2. Read first line (~20 bytes)
3. Does it start with `@markdownai`? If no → pass through immediately
4. Yes → route through MCP server `read_file` tool
5. Return resolved content as if it were the file contents

**Hook is installed via `mai init`:**
```bash
mai init                          # auto-detect AI client config
mai init --client claude-code     # explicit client
mai init --client cursor          # other MCP clients
```

`mai init` installs the hook into the AI client's config (e.g. `~/.claude/settings.json` for Claude Code). Idempotent -- safe to run multiple times.

**The hook is ~50 lines total.** It is intentionally minimal. All logic lives in the MCP server.

**The AI never knows the hook exists.** It requests a file, receives resolved content. The routing is transparent.

## Known Issues
(none)
