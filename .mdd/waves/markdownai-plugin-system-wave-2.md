---
id: markdownai-plugin-system-wave-2
title: "Wave 2: Consumer Directives, MCP Tool, and Example Plugin"
initiative: markdownai-plugin-system
initiative_version: 2
status: planned
depends_on: markdownai-plugin-system-wave-1
demo_state: "@markdownai-detect as=info include=\"layout\" returns matching plugins against a fixture project; @plugin-data name=\"mdd\" returns the MDD plugin descriptor directly; available_directives MCP tool responds with the full directive catalog; example non-MDD plugin is loaded, detected, and its layout returned correctly"
created: 2026-05-25
hash: 49fdf14a
---

# Wave 2: Consumer Directives, MCP Tool, and Example Plugin

## Demo-State

`@markdownai-detect as=info include="layout"` returns matching plugins against a fixture project; `@plugin-data name="mdd"` returns the MDD plugin descriptor directly; `available_directives` MCP tool responds with the full directive catalog; example non-MDD plugin is loaded, detected, and its layout returned correctly.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | plugin-detect-directive | - | planned | plugin-loader (wave 1) |
| 2 | plugin-data-directive | - | planned | plugin-loader (wave 1) |
| 3 | available-directives-tool | - | planned | plugin-loader (wave 1) |
| 4 | plugin-example | - | planned | plugin-detect-directive |

## Open Research

(none)
