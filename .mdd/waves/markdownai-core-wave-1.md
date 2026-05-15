---
id: markdownai-core-wave-1
title: "Wave 1: Runnable Core"
initiative: markdownai-core
initiative_version: 1
status: complete
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
| 1 | parser | .mdd/docs/01-parser.md | complete | — |
| 2 | renderer | .mdd/docs/02-renderer.md | complete | parser |
| 3 | engine | .mdd/docs/03-engine.md | complete | parser, renderer |
| 4 | cli-core | .mdd/docs/04-cli-core.md | complete | parser, renderer, engine |

## Open Research

(none)
