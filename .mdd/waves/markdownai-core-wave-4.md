---
id: markdownai-core-wave-4
title: "Wave 4: Auxiliary Tooling"
initiative: markdownai-core
initiative_version: 1
status: planned
depends_on: markdownai-core-wave-3
demo_state: "`mai strip` produces clean markdown. MCP server starts and intercepts AI reads. Hook installed via `mai init`. All CLI commands functional. `@cache` works across all modes."
created: 2026-05-14
hash:
---

# Wave 4: Auxiliary Tooling

## Demo-State

`mai strip` produces clean markdown. MCP server starts and intercepts AI reads. Hook installed via `mai init`. All CLI commands functional. `@cache` works across all modes.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | caching | .mdd/docs/28-caching.md | planned | — |
| 2 | stripper | .mdd/docs/29-stripper.md | planned | — |
| 3 | mcp-server | .mdd/docs/30-mcp-server.md | planned | caching |
| 4 | hook | .mdd/docs/31-hook.md | planned | mcp-server |
| 5 | cli-complete | .mdd/docs/32-cli-complete.md | planned | caching, stripper, mcp-server |

## Open Research

(none)
