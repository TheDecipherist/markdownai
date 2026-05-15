---
id: 32-cli-complete
title: CLI Complete — All Remaining mai Commands
edition: Both
depends_on: [28-caching, 29-stripper, 30-mcp-server]
source_files:
  - packages/core/src/commands/strip.ts
  - packages/core/src/commands/build.ts
  - packages/core/src/commands/watch.ts
  - packages/core/src/commands/serve.ts
  - packages/core/src/commands/cache.ts
  - packages/core/src/commands/security.ts
  - packages/core/src/commands/init.ts
  - packages/core/src/commands/list-phases.ts
  - packages/core/src/commands/list-macros.ts
  - packages/core/src/commands/list-imports.ts
wave: markdownai-core-wave-4
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [cli, mai, strip, build, watch, serve, cache, security, init, all-commands]
path: Toolchain/CLI
known_issues: []
---

# 32 — CLI Complete — All Remaining mai Commands

## Purpose

Completes the full `mai` CLI with all commands not implemented in Wave 1 cli-core.

## Business Rules

**`mai strip <file>`** -- see stripper feature doc (29-stripper)

**`mai build <file>`:**
- Full render pipeline with output to file
- `--output, -o <path>` required for file output
- Equivalent to render but writes to disk
- Watch mode: `mai build --watch input.md -o dist/output.md`

**`mai watch <file>`:**
- Watches source files for changes, re-renders automatically
- Debounced -- 300ms after last change before re-render

**`mai serve`:**
- Starts MCP server
- `--cwd <path>`, `--port <N>`

**`mai cache` subcommands:**
- `mai cache show [file] [--expired] [--persist] [--session]`
- `mai cache clear [--session] [--persist] [--directive <type>] [file]`
- `mai cache seed <file> [--env <file>] [--directive <type>]`

**`mai security` subcommands:**
- `mai security init [--from .markdownai.json]`
- `mai security show`
- `mai security disable`
- Shell: `enable`, `disable`, `add`, `remove`, `list`, `test`
- DB: `add`, `set`, `allow-collection`, `deny-keyword`, `test`, `disable`
- HTTP: `enable`, `disable`, `add-domain`, `remove-domain`, `test`
- Filesystem: `show`, `add-block-path`, `add-block-pattern`, `allow-path`, `allow-pattern`, `test`, `test-mask`
- Audit: `show`, `show --blocked`, `show --alerts`, `show --since <date>`, `clear`

**`mai init`** -- see hook feature doc (31-hook)

**`mai list-phases <file>`** -- list phases with transitions
**`mai list-macros <file>`** -- list all macros with source file
**`mai list-imports <file>`** -- full dependency tree

**Universal flags:** `--env`, `--cwd`, `--verbose`, `--strict`, `--silent`, `--output`, `--version`, `--help`
Note: `--silent` never suppresses SECURITY_ALERT or FATAL.

## Known Issues
(none)
