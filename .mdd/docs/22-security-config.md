---
id: 22-security-config
title: Security — Config File, Runtime Modes, Audit Log
edition: Both
depends_on: []
source_files:
  - packages/engine/src/security/config.ts
  - packages/engine/src/security/audit.ts
  - packages/engine/src/security/modes.ts
wave: markdownai-core-wave-3
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-15
status: complete
mdd_version: 1
tags: [security, jail-model, config-file, runtime-modes, audit-log, principles]
path: Security
known_issues: []
---

# 22 — Security — Config File, Runtime Modes, Audit Log

## Purpose

The security configuration foundation. Jail-first model: all dynamic directives (@query, @db, @http) are stripped by default. Machine owner controls execution via `~/.markdownai/security.json`. Documents have zero trust.

## Business Rules

**Config location:** `~/.markdownai/security.json`

**Jail-first defaults:** @query, @db, @http all stripped unless explicitly allowed. Static directives (@include, @import, @read) use filesystem confinement + masking instead.

**Runtime modes:**

| Mode | Flag | Behavior |
|---|---|---|
| Silent | default | Strip jailed directives, log to file only |
| Verbose | `--verbose` | Print WARN+ to terminal as they happen |
| Strict | `--strict` | WARN = error, halt on any stripped directive |

**FATAL and SECURITY_ALERT always print to terminal regardless of mode. Cannot be silenced.**

**Log levels:**
- DEBUG, INFO → file only
- WARN → file only (verbose: terminal)
- ERROR → terminal always
- FATAL → terminal always
- SECURITY_ALERT → terminal always

**Runtime log:** `~/.markdownai/runtime.log` -- all WARN+ events as JSON entries.

**Audit log:** `~/.markdownai/audit.log` -- security-specific events only. Cannot be disabled by any document or config.

**Rule evaluation order:**
1. Built-in always_block? → BLOCKED, SECURITY_ALERT, always printed
2. Built-in always_alert? → check user allowlist
   - In allowlist? → ALLOWED, SECURITY_NOTICE always printed
   - Not in allowlist? → BLOCKED, SECURITY_NOTICE always printed
3. User deny_patterns? → BLOCKED, WARN
4. User allowlist match? No → STRIPPED, WARN
5. User allowlist match? Yes → ALLOWED, INFO

## Known Issues
(none)
