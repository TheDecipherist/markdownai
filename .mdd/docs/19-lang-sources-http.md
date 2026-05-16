---
id: 19-lang-sources-http
title: Language — @http HTTP Request Directive
edition: Both
depends_on: [13-lang-pipeline]
source_files:
  - packages/parser/src/directives/http.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [http, api, request, jailed, domain-allowlist, json-response, headers, post]
path: Language/Sources
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 19 — Language — @http HTTP Request Directive

## Purpose

Makes HTTP requests and returns response data as pipeable output. Jailed -- stripped by default.

## Business Rules

**Jailed directive:** stripped silently unless domain is in `~/.markdownai/security.json` http allowlist.

**Options:**
- `url="..."` or `url=env.VAR` -- required
- `path="dot.notation"` -- selector into JSON response
- `method="GET|POST|PUT|DELETE"` -- default GET
- `body='{"key":"value"}'` -- request body, only valid when method != GET
- `headers="Key=env.VAR,Key2=value"` -- comma-separated key=value pairs. Literal credentials blocked by masking.
- `timeout=5000` -- milliseconds, overrides security config default
- `columns="field:Name"` -- select/rename from JSON array response
- `where="expression"` -- row filter on JSON array response
- `as="type"` -- shorthand for `| @render type="..."`
- `@cache session|persist|ttl=N|mock=./file.json` -- last modifier

**Response handling:**
- JSON object → `path` extracts value or full object
- JSON array → `columns`, `where`, `as` apply
- Plain text → returned as-is, pipeable
- Non-200 → empty string, WARN logged; --strict makes it error
- Timeout → empty string, ERROR logged

**Security:** POST/PUT/DELETE require explicit permission in security config. Cloud metadata endpoints (169.254.169.254 etc) always blocked -- built-in immutable rule.

## Known Issues
(none)
