---
id: 74-db-error-handling
title: DB — Error Handling
type: SPEC
initiative: markdownai-db
wave: markdownai-db-wave-3
wave_status: planned
edition: Both
depends_on: [68-db-executor]
source_files:
  - packages/engine/src/db/executor.ts
  - packages/engine/src/db/query.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: draft
phase: documentation
mdd_version: 1
tags: [db, error-handling, parse-errors, runtime-errors, fatal, warn, strict, no-results]
path: DB/Errors
known_issues: []
---

# 74 — DB — Error Handling

## What to Build

This SPEC describes how errors in @db directives are handled: parse errors, runtime errors, zero-result queries, and max_results hits. The implementing COMPONENTs are `query.ts` (parse errors) and `executor.ts` (runtime errors).

Three error categories exist: parse errors that halt immediately with a clear message, runtime errors that produce empty output, and soft conditions (zero results, max_results cap) that produce empty or truncated output with no error.

## Architecture

Error handling is split across two files:
- `query.ts` produces parse errors when @db options are invalid
- `executor.ts` produces runtime errors when adapter calls fail

Parse errors are always FATAL. Runtime errors are ERROR (produce empty output) by default, and FATAL with `--strict`.

## Implementation Notes

Parse errors must include the file path, line number, what was found, and how to fix it. The format in the spec is the exact format to implement - do not use a generic error format.

Zero results is not an error. An operation returning no rows produces an empty string. Piping an empty result into @render produces an empty table with headers. Piping into `wc -l` produces `0`. This behavior is explicit and correct.

Max_results hits are silent from the author's perspective (the document keeps rendering) but must be logged as WARN so operators can identify queries that need optimization.

## Data Model

**Parse error format:**

```
ERROR: @db directive requires exactly one operation (find, one, count, aggregate, or raw)

  File:   ./docs/status.md
  Line:   34
  Found:  find="users" and count="users" on the same directive

  Use one operation per @db directive. For multiple queries, use multiple directives.
```

Required fields in every parse error:
- Error description (what the rule is)
- `File:` path
- `Line:` number
- `Found:` what was actually seen in the directive
- A fix hint on the last line

## API / Interface

**Error categories:**

| Condition | Severity | Document behavior |
|---|---|---|
| Invalid options / missing required option / conflicting operations | FATAL | Document halts immediately |
| Connection failure / query timeout / adapter error | ERROR (default) / FATAL (--strict) | Empty output, rendering continues |
| Zero rows returned | none | Empty string output, no log entry |
| max_results hit | WARN | Result truncated to max_results, rendering continues |
| raw= without allow_raw | WARN | Directive stripped, rendering continues |
| Security block (denied collection, denied operation) | ERROR | Empty output or FATAL depending on strict mode |
| Immutable block pattern match | SECURITY_ALERT | Document halts immediately |

## Business Rules

1. Parse errors (invalid options, missing required option, conflicting operations) are always FATAL. The document halts immediately with the error format above.
2. Parse errors must include file path, line number, what was found, and a fix hint.
3. Runtime errors (connection failure, query timeout, adapter exception) produce empty output with an ERROR log entry. With `--strict`, they are FATAL.
4. Zero rows returned is not an error and produces no log entry. Output is an empty string.
5. max_results hit: silently truncate result to max_results, log WARN. The document continues rendering.
6. Conflicting operations on a single directive (more than one of find/one/count/aggregate/raw) is always FATAL, not a runtime error.
7. `--strict` mode escalates runtime errors from ERROR to FATAL.
8. `--silent` never suppresses SECURITY_ALERT or FATAL errors (per the global CLAUDE.md rule).

## Acceptance Criteria

- Parsing `find="users" count="users"` produces a FATAL error with the exact format (File, Line, Found, fix hint)
- A connection failure at runtime produces an empty string output and ERROR log entry (document continues)
- A connection failure with `--strict` produces FATAL and halts the document
- A query returning zero rows produces empty string output with no log entry
- A query returning 1500 rows against `max_results: 1000` returns 1000 rows and logs exactly one WARN
- Immutable block pattern match produces SECURITY_ALERT and halts the document regardless of `--strict` or `--silent`
- `--silent` with FATAL parse error still outputs the error message

## Dependencies

- `68-db-executor` — runtime error handling implementation
- `72-db-security` — security blocks that trigger ERROR or SECURITY_ALERT

## Known Issues

(none - imported from spec)
