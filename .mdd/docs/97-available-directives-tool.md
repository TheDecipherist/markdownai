---
id: 97-available-directives-tool
title: Available Directives MCP Tool
edition: MarkdownAI
depends_on: ["01-parser", "30-mcp-server"]
relates: ["95-plugin-detect-directive", "96-plugin-data-directive"]
source_files:
  - packages/parser/src/registry.ts
  - packages/mcp/src/tools/available_directives.ts
  - packages/mcp/src/server.ts
  - packages/mcp/src/index.ts
routes: []
models: []
test_files:
  - packages/mcp/src/__tests__/available-directives.test.ts
data_flow: reads-existing
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [plugin-system, mcp, directives, catalog, introspection]
path: MCP/Tools
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
initiative: markdownai-plugin-system
wave: markdownai-plugin-system-wave-2
wave_status: active
---

# 97 - Available Directives MCP Tool

## Purpose

Exposes the full catalog of registered MarkdownAI directives as an MCP tool. Lets AI consumers, IDE integrations, and plugin authors introspect what directives the current parser installation supports — without parsing source code or guessing.

## Architecture

```
MCP client calls: available_directives({ include_plugin_directives?: boolean })
  |
  +-- tools/available_directives.ts
  |     calls getAvailableDirectives() from @markdownai/parser
  |
  +-- returns DirectiveCatalog {
        directives: DirectiveInfo[]
        count: number
      }
```

`getAvailableDirectives()` is a new export from `packages/parser/src/registry.ts` that reads the existing `registry` Map and returns a sorted array of directive metadata.

## Parser Export

New function added to `packages/parser/src/registry.ts`:

```typescript
export interface DirectiveInfo {
  name: string
  block: boolean
  closeTag?: string
}

export function getAvailableDirectives(): DirectiveInfo[]
```

Returns one entry per registered module, sorted alphabetically by name.

## MCP Tool

**Tool name:** `available_directives`

**Input schema:**
```typescript
{
  include_plugin_directives?: boolean  // default: true — include plugin-meta, plugin-detect etc.
}
```

**Output:**
```typescript
{
  directives: DirectiveInfo[]  // sorted alphabetically
  count: number
}
```

**Example output:**
```json
{
  "directives": [
    { "name": "append-if-missing", "block": false },
    { "name": "call", "block": true, "closeTag": "end" },
    { "name": "check", "block": false },
    { "name": "constraint", "block": false },
    { "name": "count", "block": false },
    ...
    { "name": "plugin-conventions", "block": true, "closeTag": "end" },
    { "name": "plugin-data", "block": false },
    { "name": "markdownai-detect", "block": false },
    ...
  ],
  "count": 47
}
```

If `include_plugin_directives: false`, directives whose names start with `plugin-` are excluded. `markdownai-detect` and `plugin-data` are always included since they are consumer directives, not plugin-file-only blocks.

## Business Rules

- Always returns the live registry state — no caching, no static list
- `include_plugin_directives` defaults to `true`
- Sorting is alphabetical by `name`
- No input validation needed beyond the boolean flag — no paths, no user data
- `count` always equals `directives.length`

## Data Flow

Reads from the in-memory registry (no filesystem). Pure introspection.

## Dependencies

- `01-parser` — registry module, `ParseModule` type
- `30-mcp-server` — tool registration pattern, MCP SDK usage

## Security

No filesystem access, no user-controlled paths, no environment reads. Pure catalog exposure — safe to call without restrictions.

## Known Issues

(none)
