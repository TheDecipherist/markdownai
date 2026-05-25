---
id: markdownai-plugin-system-wave-1
title: "Wave 1: Plugin File Format and Loader"
initiative: markdownai-plugin-system
initiative_version: 1
status: complete
depends_on: none
demo_state: "mai parse mdd.plugin.md succeeds; loader scans all three search paths, validates each plugin file, rejects any containing executable directives, and exposes a typed JS API returning loaded plugin data"
created: 2026-05-25
hash: 10a18e50
---

# Wave 1: Plugin File Format and Loader

## Demo-State

`mai parse mdd.plugin.md` succeeds; loader scans all three search paths, validates each plugin file, rejects any containing executable directives, and exposes a typed JS API returning loaded plugin data.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | plugin-parser-nodes | .mdd/docs/93-plugin-parser-nodes.md | complete | - |
| 2 | plugin-loader | .mdd/docs/94-plugin-loader.md | complete | plugin-parser-nodes |

## Open Research

(none)
