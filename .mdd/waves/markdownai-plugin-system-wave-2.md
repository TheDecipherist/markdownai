---
id: markdownai-plugin-system-wave-2
title: "Wave 2: Consumer Directives, MCP Tool, and Example Plugin"
initiative: markdownai-plugin-system
initiative_version: 2
status: complete
depends_on: markdownai-plugin-system-wave-1
demo_state: "@markdownai-detect as=info include=\"layout\" returns matching plugins against a fixture project; @plugin-data name=\"mdd\" returns the MDD plugin descriptor directly; available_directives MCP tool responds with the full directive catalog; example non-MDD plugin is loaded, detected, and its layout returned correctly"
created: 2026-05-25
hash: b735c71c
---

# Wave 2: Consumer Directives, MCP Tool, and Example Plugin

## Demo-State

`@markdownai-detect as=info include="layout"` returns matching plugins against a fixture project; `@plugin-data name="mdd"` returns the MDD plugin descriptor directly; `available_directives` MCP tool responds with the full directive catalog; example non-MDD plugin is loaded, detected, and its layout returned correctly.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | plugin-detect-directive | .mdd/docs/95-plugin-detect-directive.md | complete | plugin-loader (wave 1) |
| 2 | plugin-data-directive | .mdd/docs/96-plugin-data-directive.md | complete | plugin-loader (wave 1) |
| 3 | available-directives-tool | .mdd/docs/97-available-directives-tool.md | complete | plugin-loader (wave 1) |
| 4 | plugin-example | .mdd/docs/98-plugin-example.md | complete | plugin-detect-directive |

## Open Research

(none)
