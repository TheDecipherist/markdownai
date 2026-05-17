---
id: markdownai-db-wave-3
title: "Wave 3: Security, Caching & Error Handling"
initiative: markdownai-db
initiative_version: 1
status: complete
depends_on: markdownai-db-wave-2
demo_state: "Security config blocks forbidden operations. raw= requires allow_raw. max_results cap truncates silently. @cache session seeds and replays. Parse errors halt the document with a clear message."
created: 2026-05-17
hash: 252402c808f463a2
---

# Wave 3: Security, Caching & Error Handling

## Demo-State

Security config blocks forbidden operations. raw= requires allow_raw. max_results cap truncates silently. @cache session seeds and replays. Parse errors halt the document with a clear message.
*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Type | Status | Depends on |
|---|---------|-----|------|--------|------------|
| 1 | db-security | docs/72-db-security.md | SPEC | active | 68-db-executor, 66-db-raw-escape-hatch |
| 2 | db-caching | docs/73-db-caching.md | SPEC | complete | 68-db-executor, 28-caching |
| 3 | db-error-handling | docs/74-db-error-handling.md | SPEC | complete | 68-db-executor |

## Open Research

(none - imported from spec)
