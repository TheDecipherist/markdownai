---
id: 90-lang-dynamic-include-path
title: Language - Dynamic Path Expressions in @include
edition: MarkdownAI
depends_on: [10-lang-include, 12-lang-conditionals, 09-lang-file-resolution, 23-security-filesystem]
relates: [10-lang-include, 12-lang-conditionals]
source_files:
  - packages/engine/src/engine-include.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/include-dynamic-path.test.ts
data_flow: reads-existing
last_synced: 2026-05-24
status: complete
phase: all
mdd_version: 1
tags: [include, dynamic-path, expressions, arguments, interpolation, engine]
path: Language/Include
integration_contracts: []
satisfies_contracts:
  - from: 23-security-filesystem
    function: checkSourcePath(full, sourceJail, allowedSourcePaths, filesystemConfig)
    when: after interpolatePathExpressions() resolves the final path, before readFileSync
    status: done
    verified_at: "packages/engine/src/engine-include.ts:118"
security_read_sites:
  - packages/engine/src/engine-include.ts (interpolatePathExpressions result passed to checkSourcePath)
known_issues: []
sister_projects: []
---

# 90 - Dynamic Path Expressions in @include

## Purpose

Allows `{{ expression }}` segments inside `@include` file paths to be evaluated at runtime,
so a single `@include` line can select different files based on arguments, environment, or any
expression the sandbox supports. This replaces multi-branch `@if`/`@elseif` chains that differ
only in which file they include.

## Architecture

The feature lives entirely in the engine layer. The parser treats `{{ }}` segments inside paths
as opaque text (no parser changes needed). At execution time, `executeInclude()` gains a second
expansion step between the existing `${VAR}` expansion and the path resolution:

```
node.path (raw)
  → expandImportPath()             — existing: resolves ${VAR} patterns
  → interpolatePathExpressions()   — NEW: evaluates {{ expression }} segments
  → resolve(ctx.docDir, …)         — existing: produces absolute path
  → checkSourcePath()              — existing: enforces confinement
  → readFileSync()                 — existing: reads file
```

`interpolatePathExpressions()` lives in `packages/engine/src/engine-include.ts` and reuses the
already-exported `evalExpression()` from `conditions.ts` for each `{{ }}` segment it finds.
No new parsing primitives are needed — the `\{\{\s*([\s\S]*?)\s*\}\}` regex already handles
nested brackets inside expressions (e.g. `{{ARGUMENTS[0]}}`) correctly via non-greedy matching
with `}}` as the unambiguous terminator.

## Syntax

```markdown
@include ./{{arg0}}-mode.md
@include ./prefix-{{arg1}}.md
@include ./{{arg0}}/{{arg1}}.md
```

The expression inside `{{ }}` is full JS evaluated in the same sandbox as `@if` conditions:
- `ARGUMENTS`, `arg0`, `arg1`, `arg2`, `arg3`, `argsList[]`, `env.*`
- Preprocessing: `$ARGUMENTS[0]` -> `argsList[0]`, `$0` -> `argsList[0]`
- JS `||` works as a fallback: `{{arg0 || 'audit'}}` defaults to `'audit'` when arg0 is empty

### Canonical example

Before (6 lines):
```markdown
@if ARGUMENTS.startsWith("audit")
  @include ./audit-mode.md
@elseif ARGUMENTS.startsWith("build")
  @include ./build-mode.md
@elseif ARGUMENTS.startsWith("plan")
  @include ./plan-mode.md
@endif
```

After (1 line):
```markdown
@include ./{{arg0}}-mode.md
```

With a default:
```markdown
@include ./{{arg0 || 'audit'}}-mode.md
```

## Business Rules

1. `{{ expression }}` segments in the path are extracted with the same regex used by the
   interpolation system: `/\{\{\s*([\s\S]*?)\s*\}\}/g`. Non-greedy matching means nested
   brackets in expressions (e.g. `ARGUMENTS[0]`) are handled correctly with no special parser.
2. The expression is evaluated via `evalExpression()`, which applies the same preprocessing as
   `@if` conditions (`$ARGUMENTS[0]` -> `argsList[0]`, etc.) before running in the VM sandbox.
3. If any `{{ }}` segment evaluates to an empty string, `null`, or `undefined`, `executeInclude()`
   throws a `FatalError` with a clear message naming the raw path.
4. The evaluated string is inserted as-is into the path. Any resulting path traversal
   (`..` segments introduced by the evaluated value) is caught by `checkSourcePath()`.
5. Static path validation in the parser (`/` prefix check, `..` check) still applies to the
   raw path text before dynamic expansion. Runtime traversal is caught by confinement.
6. If the expanded file does not exist, `executeInclude()` emits a warning and returns `''`
   (same behavior as a static missing include).

## Data Flow

- **Source:** user writes `@include ./{{arg0}}-mode.md` in a MarkdownAI document
- **Parse:** `packages/parser/src/directives/include.ts:10` captures path as literal string `./{{arg0}}-mode.md`
- **Static expansion:** `engine-include.ts:101` - `expandImportPath()` handles `${VAR}` (ignores `{{ }}`)
- **Dynamic expansion (new):** `interpolatePathExpressions(expanded, ctx)` - finds `{{ }}` segments, calls `evalExpression()`, substitutes result
- **Path resolution:** `engine-include.ts:102` - `resolve(ctx.docDir, finalPath)` produces absolute path
- **Security gate:** `engine-include.ts:103-106` - `checkSourcePath()` enforces jail
- **File read:** `engine-include.ts:113` - `readFileSync(full, 'utf8')`

## Dependencies

- **10-lang-include** - the `@include` directive this feature extends
- **12-lang-conditionals** - provides `evalExpression()` and the expression sandbox
- **09-lang-file-resolution** - path resolution model; dynamic paths follow the same rules
- **23-security-filesystem** - `checkSourcePath()` is the security gate; dynamic paths are not exempt

## Security

This feature accepts dynamic user-controlled or caller-controlled values (via `ARGUMENTS`,
`arg0`, etc.) into a file path. The threat model is the same as for `@if` expressions
but with an additional file-path injection surface.

**Trusted vs untrusted boundary:** `arg0` and `ARGUMENTS` originate from the skill caller
(MCP client or CLI invocation). They are untrusted.

**What a malicious caller could attempt:**
- Path traversal: `arg0 = "../../etc/shadow"` -> path becomes `../../etc/shadow-mode.md`
  -> `checkSourcePath()` enforces jail before the file is read. Blocked.
- Prototype pollution via expression: mitigated by the `runInNewContext` VM sandbox
  (no shared prototype, 500ms timeout).
- Empty-string injection to cause a silent no-op: handled by the empty-value FatalError rule.

**Validation required before use:** The expanded path MUST go through `checkSourcePath()`
before any file operation. This is already enforced in `executeInclude()` and must not be
bypassed when adding the interpolation step.

**What expressions cannot access:** `process`, `require`, `import`, and all Node.js built-ins
are excluded by the VM sandbox.

## Known Issues

(none yet)

## Bugs

(none yet - populated by /mdd bug when issues are reported)
