---
id: 72-db-security
title: DB — Security System
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-3
wave_status: planned
edition: Both
depends_on: [68-db-executor, 66-db-raw-escape-hatch]
source_files:
  - packages/engine/src/db/executor.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: draft
phase: documentation
mdd_version: 1
tags: [db, security, security-config, allowed-operations, denied-collections, max-results, immutable-rules, allow-raw]
path: DB/Security
known_issues: []
---

# 72 — DB — Security System

## What to Build

This SPEC describes the security configuration model for @db directives: the JSON config structure in `~/.markdownai/security.json`, the per-connection settings, the allowed/denied collection controls, the `max_results` cap, and the built-in immutable block patterns that cannot be overridden by any config.

The implementing COMPONENT is `68-db-executor` which consults the security config before executing any query.

## Architecture

Security config is read from `~/.markdownai/security.json` at startup. The executor checks the config before any query reaches an adapter. Immutable block patterns are applied at the directive level, before even checking `allow_raw`.

The security model has two layers:
1. **Config-driven controls:** per-connection settings that administrators configure
2. **Immutable block rules:** patterns hardcoded in the engine that can never be disabled by config

## Implementation Notes

The `max_results` cap is applied after rows are returned from the adapter. If the adapter returns more rows than `max_results`, the executor silently truncates to `max_results` and logs a WARN.

The `allowed_collections` list (when non-empty) acts as an allowlist. Any collection not in the list is blocked before the query is sent to the adapter.

The `denied_collections` list always blocks, regardless of other config. It takes precedence over `allowed_collections`.

Immutable block patterns must be checked against raw query strings at the directive level. They fire on substring match (case-insensitive for SQL patterns). A match produces SECURITY_ALERT (not a WARN - a higher severity) and halts the document.

## Data Model

**Security config structure (`~/.markdownai/security.json`):**

```json
{
  "db": {
    "primary": {
      "allowed_operations": ["find", "one", "count", "aggregate"],
      "denied_operations": [],
      "allowed_collections": [],
      "denied_collections": [],
      "allow_raw": false,
      "readonly": true,
      "max_results": 1000
    }
  }
}
```

**Per-connection config fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `allowed_operations` | string[] | all operations | If non-empty, only these operations are allowed |
| `denied_operations` | string[] | none | These operations are always blocked |
| `allowed_collections` | string[] | all collections | If non-empty, only these collections can be queried |
| `denied_collections` | string[] | none | These collections are always blocked |
| `allow_raw` | boolean | false | Whether raw= queries are permitted |
| `readonly` | boolean | true | Structural guarantee; always true |
| `max_results` | number | 1000 | Hard cap on rows returned |

**Built-in immutable always_block patterns (hardcoded, cannot be disabled):**

SQL patterns:
- `DROP *` / `DROP DATABASE` / `DROP TABLE` / `TRUNCATE`
- `DELETE FROM *` / `UPDATE * SET *` / `ALTER TABLE *`
- `CREATE USER *` / `GRANT *` / `REVOKE *`

MongoDB patterns:
- `db.dropDatabase()`
- `db.*.drop()`
- `db.*.deleteMany()` / `db.*.remove()`
- `db.*.updateMany()` / `db.*.insertMany()`
- `db.admin().*`
- `db.runCommand({shutdown*}`
- `db.runCommand({fsync*}`

## API / Interface

Security config file location: `~/.markdownai/security.json`

The executor reads this config at startup and applies it per connection before every query.

## Business Rules

1. The simple query operations (find, one, count, aggregate) only produce SELECT/find queries from a QueryPlan. No adapter generates INSERT, UPDATE, DELETE, or DROP from a QueryPlan. This is structural - the QueryPlan has no fields for write operations.
2. SQL injection is structurally impossible through the query language. Filter values are typed and bound as parameterized parameters. They never land in a raw query string.
3. `allowed_collections`: if non-empty, only listed collections/tables can be queried. Any unlisted collection is blocked before the query reaches the adapter.
4. `denied_collections`: listed collections are always blocked, regardless of `allowed_collections` or any other config.
5. `allowed_operations`: if non-empty, only listed operations are permitted.
6. `denied_operations`: listed operations are always blocked.
7. `max_results`: hard cap on rows returned. When the adapter returns more rows than the cap, the result is silently truncated and a WARN is logged. The document continues rendering.
8. Immutable block patterns are applied to raw query strings before the query reaches the adapter, even with `allow_raw: true`. A match raises SECURITY_ALERT and halts the document.
9. The `readonly: true` field is structural documentation. It reflects the design guarantee - it is not a runtime enforcement flag.
10. A connection with no security config entry inherits the default: `allow_raw: false`, `max_results: 1000`, all operations and all collections permitted.

## Acceptance Criteria

- A `find` on a collection in `denied_collections` is blocked before reaching the adapter, raising an error with a clear message
- A `find` on a collection NOT in a non-empty `allowed_collections` is blocked
- A `raw=` query on a connection with `allow_raw: false` is stripped with a WARN (not FATAL)
- A `raw=` query containing `DROP TABLE users` is blocked with SECURITY_ALERT even with `allow_raw: true`
- A `raw=` MongoDB query containing `db.users.drop()` is blocked with SECURITY_ALERT even with `allow_raw: true`
- A find that returns 1500 rows against `max_results: 1000` returns exactly 1000 rows and logs a WARN
- `denied_collections` blocks take precedence over `allowed_collections` permits
- A connection with no config entry defaults to `allow_raw: false` and `max_results: 1000`

## Dependencies

- `68-db-executor` — the COMPONENT that implements these security checks
- `66-db-raw-escape-hatch` — raw= behavior that security config controls via allow_raw
- `27-security-immutable-rules` — the broader immutable rules system this integrates with

## Known Issues

(none - imported from spec)
