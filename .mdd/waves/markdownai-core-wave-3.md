---
id: markdownai-core-wave-3
title: "Wave 3: Security Enforcement"
initiative: markdownai-core
initiative_version: 1
status: complete
depends_on: markdownai-core-wave-2
demo_state: "Jailed directives strip by default. `~/.markdownai/security.json` controls execution. Immutable rules cannot be bypassed. Content masking fires on sensitive file reads."
created: 2026-05-14
hash:
---

# Wave 3: Security Enforcement

## Demo-State

Jailed directives strip by default. `~/.markdownai/security.json` controls execution. Immutable rules cannot be bypassed. Content masking fires on sensitive file reads.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | security-config | .mdd/docs/22-security-config.md | complete | — |
| 2 | security-filesystem | .mdd/docs/23-security-filesystem.md | complete | security-config |
| 3 | security-shell | .mdd/docs/24-security-shell.md | complete | security-config |
| 4 | security-database | .mdd/docs/25-security-database.md | complete | security-config |
| 5 | security-http | .mdd/docs/26-security-http.md | complete | security-config |
| 6 | security-immutable-rules | .mdd/docs/27-security-immutable-rules.md | complete | security-filesystem, security-shell, security-database, security-http |

## Open Research

(none)
