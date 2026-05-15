---
id: 26-security-http
title: Security — HTTP Request Jail (@http)
edition: Both
depends_on: [22-security-config]
source_files:
  - packages/engine/src/security/http.ts
wave: markdownai-core-wave-3
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-15
status: complete
mdd_version: 1
tags: [security, http, domain-allowlist, internal-network, metadata-endpoint, get-only]
path: Security
known_issues: []
---

# 26 — Security — HTTP Request Jail (@http)

## Purpose

Controls which HTTP requests @http is permitted to make. Domain allowlist. GET only by default.

## Business Rules

**Security config http section:**
```json
{
  "http": {
    "enabled": false,
    "allowed_domains": ["api.github.com", "api.npmjs.org"],
    "denied_domains": [],
    "allowed_methods": ["GET"],
    "max_response_size": 1048576,
    "timeout": 10000
  }
}
```

**Built-in always_block_domains (immutable):** `169.254.169.254`, `metadata.google.internal`, `metadata.internal`, `169.254.*`, `fd00:ec2::254` -- cloud metadata endpoints always blocked, no exceptions.

**`mai security http` commands:**
- `mai security http enable`
- `mai security http add-domain api.github.com`
- `mai security http remove-domain api.github.com`
- `mai security http test "https://api.github.com/repos/markdownai/core"` → ALLOWED/BLOCKED + reason

## Known Issues
(none)
