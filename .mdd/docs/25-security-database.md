---
id: 25-security-database
title: Security — Database Query Jail (@db)
edition: Both
depends_on: [22-security-config]
source_files:
  - packages/engine/src/security/database.ts
wave: markdownai-core-wave-3
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-15
status: complete
mdd_version: 1
tags: [security, database, readonly, allowed-operations, denied-keywords]
path: Security
integration_contracts:
  - caller_feature: 03-engine
    function: checkDatabaseOperation(connection, operation, ctx.security)
    when: before executing any @db or @query node
    mandatory: true
satisfies_contracts: []
known_issues: []
---

# 25 — Security — Database Query Jail (@db)

## Purpose

Controls which database operations @db is permitted to execute. Per-connection config. Readonly by default.

## Business Rules

**Security config db section (per connection):**
```json
{
  "db": {
    "primary": {
      "allowed_operations": ["find", "aggregate", "countDocuments"],
      "denied_keywords": ["DROP", "DELETE", "UPDATE", "INSERT"],
      "allowed_collections": ["products", "orders"],
      "readonly": true,
      "max_results": 1000
    }
  }
}
```

**Built-in always_block for db:** DROP *, DROP DATABASE, DROP TABLE, TRUNCATE, DELETE FROM, UPDATE * SET, ALTER TABLE, CREATE USER, GRANT, REVOKE, db.dropDatabase(), db.*.drop(), db.*.deleteMany(), db.*.remove(), db.*.updateMany(), db.*.insertMany(), db.admin()*, db.runCommand({shutdown*}, db.runCommand({fsync*}

**`mai security db` commands:**
- `mai security db add primary`
- `mai security db set primary.readonly true`
- `mai security db allow-collection primary products`
- `mai security db deny-keyword primary DROP`
- `mai security db test primary "db.users.find()"` → ALLOWED/BLOCKED + reason

## Known Issues
(none)
