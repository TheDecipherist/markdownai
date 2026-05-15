---
id: 24-security-shell
title: Security — Shell Execution Jail (@query)
edition: Both
depends_on: [22-security-config]
source_files:
  - packages/engine/src/security/shell.ts
wave: markdownai-core-wave-3
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-15
status: complete
mdd_version: 1
tags: [security, shell, allowlist, deny-patterns, require-confirmation, audit-log]
path: Security
known_issues: []
---

# 24 — Security — Shell Execution Jail (@query)

## Purpose

Controls which shell commands @query is permitted to execute. Allowlist-first -- everything denied unless explicitly permitted.

## Business Rules

**Security config shell section:**
```json
{
  "shell": {
    "enabled": false,
    "allow_patterns": ["git log *", "npm audit *"],
    "deny_patterns": ["rm *"],
    "allow_network": false,
    "require_confirmation": false,
    "audit_log": true
  }
}
```

- `enabled: false` (default) → all @query directives stripped
- `allow_patterns` → glob patterns against command string
- `deny_patterns` → checked after allowlist -- deny wins
- Built-in always_block and always_alert patterns checked first before any config

**`mai security shell` commands:**
- `mai security shell enable`
- `mai security shell add "git log *"`
- `mai security shell remove "git log *"`
- `mai security shell list`
- `mai security shell test "git log --oneline -1"` → ALLOWED/BLOCKED + reason

## Known Issues
(none)
