---
id: 23-security-filesystem
title: Security — Filesystem Confinement and Content Masking
edition: Both
depends_on: [22-security-config]
source_files:
  - packages/engine/src/security/filesystem.ts
  - packages/engine/src/security/masking.ts
wave: markdownai-core-wave-3
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-15
status: complete
mdd_version: 1
tags: [security, filesystem, confinement, masking, document-root, content-masking, credential-protection]
path: Security
integration_contracts:
  - caller_feature: 03-engine
    function: checkFilePath(resolved, ctx.jailRoot, ctx.security)
    when: before any readFileSync in executeInclude, executeImport, executeRead
    mandatory: true
  - caller_feature: 04-cli-core
    function: checkFilePath(resolved, documentRoot, defaultConfig)
    when: before reading any file in list-imports recursive resolver
    mandatory: true
  - caller_feature: 30-mcp-server
    function: checkFilePath(resolved, ctx.jailRoot, ctx.security)
    when: before reading files in next_phase, list_phases, resolve_phase tools
    mandatory: true
satisfies_contracts: []
known_issues: []
---

# 23 — Security — Filesystem Confinement and Content Masking

## Purpose

Two-layer protection for @include, @import, and @read: path confinement (what files can be accessed) and content masking (what content can be rendered). Both are always active. Neither can be disabled.

## Business Rules

**Layer 1 -- Confinement (immutable):**
- Absolute paths → always blocked
- Traversal above document root (`../`) → always blocked
- `--allow-traversal ../path/` flag permits specific directory only, must be specified on every invocation
- Document root = directory of root document, or `--cwd` if specified

**Layer 2 -- Built-in path exclusions (immutable):**
- always_block_paths: `~/.ssh/*`, `~/.aws/*`, `~/.gnupg/*`, `~/.config/gcloud/*`, `~/.kube/*`, `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`, `/proc/*`, `/sys/*`
- always_block_patterns (filename): `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `id_rsa`, `id_ed25519`, `id_ecdsa`, `.env*`, `*.env`, `*credentials*`, `*secret*`, `*password*`, `*.token`
- always_alert_patterns: `*.json`, `config.yaml`, `config.yml`, `settings.py`, `settings.rb`, `appsettings.*` → allowed but SECURITY_NOTICE always printed

**Layer 3 -- Content masking (always active):**
Built-in masking patterns (11 regexes): generic key/secret/token patterns, connection strings, AWS keys, GitHub tokens, Stripe keys, private key PEM blocks, JWTs, generic env values (`^[A-Z][A-Z0-9_]+=.{8,}$`).

Masking fires before content is returned. Matching values → `***MASKED***`.

**Exceptions:**
- `allow_unmasked_paths` in security config: glob patterns -- files matching these skip masking entirely
- `allow_unmasked_patterns`: value patterns -- specific variable patterns restored after masking (e.g. `NODE_ENV=*`, `PORT=*`)
- Masking applied before caching -- sensitive values never stored in cache

**Full evaluation order for every @include/@import/@read:**
1. Absolute path? → BLOCKED always
2. Traversal above root? → BLOCKED always
3. Built-in always_block_paths? → BLOCKED, SECURITY_ALERT
4. Filename matches built-in always_block_patterns? → BLOCKED, SECURITY_ALERT
5. User additional_block_paths? → BLOCKED, WARN
6. Filename matches user additional_block_patterns? → BLOCKED, WARN
7. Filename matches always_alert_patterns? → continue, SECURITY_NOTICE always printed
8. File readable? → ERROR if not
9. Read content
10. Path matches allow_unmasked_paths? → skip to step 14
11. Apply built-in masking patterns → MASK matching values
12. Apply user masking patterns → MASK
13. Restore allow_unmasked_patterns → RESTORE safe values
14. Return content
15. Any masking in 11-12? → SECURITY_NOTICE always printed

## Known Issues
(none)
