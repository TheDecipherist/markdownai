---
id: markdownai-plugin-system-wave-1
title: "Wave 1: Plugin File Format and Loader"
initiative: markdownai-plugin-system
initiative_version: 1
status: planned
depends_on: none
demo_state: "mai parse mdd.plugin.md succeeds; loader scans all three search paths, validates each plugin file, rejects any containing executable directives, and exposes a typed JS API returning loaded plugin data"
created: 2026-05-25
hash: 7ffd15e3
---

# Wave 1: Plugin File Format and Loader

## Demo-State

`mai parse mdd.plugin.md` succeeds; loader scans all three search paths, validates each plugin file, rejects any containing executable directives, and exposes a typed JS API returning loaded plugin data.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | plugin-parser-nodes | - | planned | - |
| 2 | plugin-loader | - | planned | plugin-parser-nodes |

## Open Research

(none)
