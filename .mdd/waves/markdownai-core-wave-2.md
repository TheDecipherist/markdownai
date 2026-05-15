---
id: markdownai-core-wave-2
title: "Wave 2: Language Features"
initiative: markdownai-core
initiative_version: 1
status: planned
depends_on: markdownai-core-wave-1
demo_state: "Every directive renders correctly under `mai render`. `mai validate` catches all syntax errors. All language features work end to end."
created: 2026-05-14
hash:
---

# Wave 2: Language Features

## Demo-State

Every directive renders correctly under `mai render`. `mai validate` catches all syntax errors. All language features work end to end.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | lang-header | .mdd/docs/05-lang-header.md | planned | — |
| 2 | lang-interpolation | .mdd/docs/06-lang-interpolation.md | planned | — |
| 3 | lang-env | .mdd/docs/07-lang-env.md | planned | — |
| 4 | lang-macros | .mdd/docs/08-lang-macros.md | planned | lang-env |
| 5 | lang-file-resolution | .mdd/docs/09-lang-file-resolution.md | planned | — |
| 6 | lang-include | .mdd/docs/10-lang-include.md | planned | lang-file-resolution, lang-macros |
| 7 | lang-import | .mdd/docs/11-lang-import.md | planned | lang-file-resolution, lang-env |
| 8 | lang-conditionals | .mdd/docs/12-lang-conditionals.md | planned | lang-env, lang-interpolation |
| 9 | lang-pipeline | .mdd/docs/13-lang-pipeline.md | planned | — |
| 10 | lang-sources-list | .mdd/docs/14-lang-sources-list.md | planned | lang-pipeline |
| 11 | lang-sources-read | .mdd/docs/15-lang-sources-read.md | planned | lang-pipeline |
| 12 | lang-sources-utilities | .mdd/docs/16-lang-sources-utilities.md | planned | — |
| 13 | lang-connect | .mdd/docs/17-lang-connect.md | planned | lang-env |
| 14 | lang-sources-db | .mdd/docs/18-lang-sources-db.md | planned | lang-connect, lang-pipeline |
| 15 | lang-sources-http | .mdd/docs/19-lang-sources-http.md | planned | lang-pipeline |
| 16 | lang-sources-query | .mdd/docs/20-lang-sources-query.md | planned | lang-pipeline |
| 17 | lang-phases | .mdd/docs/21-lang-phases.md | planned | lang-macros, lang-include |

## Open Research

(none)
