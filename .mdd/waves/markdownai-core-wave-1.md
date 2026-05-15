---
id: markdownai-core-wave-1
title: "Wave 1: Runnable Core"
initiative: markdownai-core
initiative_version: 1
status: planned
depends_on: none
demo_state: "`mai render input.md` produces output. `mai validate input.md` reports errors."
created: 2026-05-14
hash:
---

# Wave 1: Runnable Core

## Demo-State

`mai render input.md` produces output. `mai validate input.md` reports errors.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | parser | .mdd/docs/01-parser.md | planned | — |
| 2 | renderer | .mdd/docs/02-renderer.md | planned | parser |
| 3 | engine | .mdd/docs/03-engine.md | planned | parser, renderer |
| 4 | cli-core | .mdd/docs/04-cli-core.md | planned | parser, renderer, engine |

## Open Research

(none)
