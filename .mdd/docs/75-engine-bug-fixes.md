---
id: 75-engine-bug-fixes
title: Engine Bug Fixes - Security Load, Macro Queries, Undefined Labels, Import Paths
edition: core
depends_on: [03-engine, 08-lang-macros, 11-lang-import, 12-lang-conditionals, 20-lang-sources-query, 22-security-config]
source_files:
  - packages/core/src/commands/render.ts
  - packages/engine/src/conditions.ts
  - packages/engine/src/engine.ts
routes: []
models: []
test_files:
  - packages/core/src/__tests__/cli.test.ts
  - packages/engine/src/__tests__/engine.test.ts
  - packages/engine/src/__tests__/conditions.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1
tags: [engine, security, query, macros, conditionals, import, bugfix, render]
path: Toolchain/Engine
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 75 - Engine Bug Fixes: Security Load, Macro Queries, Undefined Labels, Import Paths

## Purpose

Four bugs in the engine execution layer caused @query to silently fail, @if to emit confusing errors on undefined labels, and @import to crash hard on absolute paths. These are correctness fixes - no new behavior, just closing gaps between documented and actual behavior.

## Architecture

Three files change. All fixes are isolated to their respective functions - no cross-cutting refactors.

```
render.ts         ISSUE-002  load security.json before calling execute()
conditions.ts     ISSUE-004  suppress ReferenceError warning for undefined labels in @if
engine.ts         ISSUE-005  downgrade FatalError to warning for absolute @import paths
```

ISSUE-003 (@query inside @define/@call returning empty) is a downstream effect of ISSUE-002. Once security.json is loaded, @query in macros works correctly - the macro body executes at call time via `walkNodes(substituteParams(...), ctx)` and the same `ctx` carries the security config.

## Data Model

No data model changes.

## API Endpoints

No endpoint changes.

## Business Rules

**ISSUE-002 - Security config never loaded in render path:**
- `render.ts:runRender()` calls `execute(ast, { ctx: { envFiles, cwd, consumer } })` with no security field
- `makeContext()` defaults to `{ allowShell: false, allowHttp: false, allowDb: false, jailRoot: null }`
- `mai security shell enable` correctly writes `~/.markdownai/security.json` with `shell.enabled: true`
- The two are disconnected - security config written by `mai security` is never read by `mai render`
- Fix: call `loadSecurityConfig()` in `runRender()` and pass the result as `ctx.security`
- Mapping: `shell.enabled -> allowShell`, `http.enabled -> allowHttp`, `Object.keys(db).length > 0 -> allowDb`, `filesystem -> filesystemConfig`, `shell -> shellConfig`
- `jailRoot` is left `null` - the engine sets it from `filePath` at runtime (engine.ts:75-77)

**ISSUE-003 - @query in @define/@call downstream of ISSUE-002:**
- `handleCall` calls `walkNodes(substituteParams(macro.body, namedArgs), ctx)` - execution is at call time
- `substituteParams` preserves the QueryNode's `args` (including `label`) via `subArgs`
- `walkNode` for 'query' sets the label in `ctx.envFiles` regardless of whether lines is empty
- The only reason @query returns `[]` inside a macro is that `allowShell` is false (ISSUE-002)
- No independent fix needed - ISSUE-002 fix resolves this

**ISSUE-004 - @if on undefined label produces confusing warnings:**
- `evalCondition` expands `{{ label }}` via `runExpr(label, ctx)`
- If `label` is not in the sandbox, `runInNewContext` throws `ReferenceError`
- `runExpr` catches ALL exceptions and pushes `Unresolvable expression: <expr>` warning
- Fix: in `runExpr`, check if caught error is `ReferenceError` - if so, return `undefined` silently (no warning)
- Non-ReferenceError exceptions (SyntaxError, TypeError) still push the warning
- User preference: undefined labels evaluate to `""` with no warning

**ISSUE-005 - @import absolute path throws FatalError:**
- `executeImport` throws `new FatalError('@import blocked: Absolute paths are not permitted')` for absolute paths
- `FatalError` terminates the entire render with an unrecoverable error
- An absolute path is a user input error, not a program fault - it should degrade gracefully
- Fix: instead of throwing `FatalError`, push a warning to `ctx.warnings` and return early
- Warning format: `@import: absolute paths are not permitted (${node.path}) - skipped`
- This matches how `@include` handles non-blocked/alert-level issues (warning + skip)

## Data Flow

Greenfield - modifications to existing execution paths.

ISSUE-002 data flow:
```
~/.markdownai/security.json
  -> loadSecurityConfig()
  -> SecurityJsonConfig { shell.enabled, http.enabled, db, filesystem, shell }
  -> Partial<EngineContext>.security
  -> makeContext() merges into SecurityConfig
  -> executeQuery / executeHttp / executeDb read allowShell/allowHttp/allowDb
```

## Dependencies

- 03-engine: execute() entry point and EngineOptions/EngineContext types
- 08-lang-macros: handleCall + substituteParams - confirms macro body runs at call time
- 11-lang-import: executeImport - where ISSUE-005 fix lives
- 12-lang-conditionals: evalCondition / runExpr - where ISSUE-004 fix lives
- 20-lang-sources-query: executeQuery - confirms allowShell gate behavior
- 22-security-config: loadSecurityConfig() and SecurityJsonConfig types

## Security

These fixes do not expand any security surface. ISSUE-002 loads the EXISTING security config that users have deliberately configured via `mai security`. The fix closes a disconnect - it does not bypass any security checks.

ISSUE-005 makes the failure mode softer (warning vs. crash) but does not allow absolute path access. The `checkFilePath` result of `level: 'blocked'` still prevents any file read.

## Known Issues

- ISSUE-003 verification: after ISSUE-002 is fixed, a dedicated test should confirm @query with label inside @define/@call correctly populates the label in ctx.envFiles
