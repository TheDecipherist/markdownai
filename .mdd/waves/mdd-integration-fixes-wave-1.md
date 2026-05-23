---
id: mdd-integration-fixes-wave-1
title: "Wave 1: Source vs Data Root Split"
initiative: mdd-integration-fixes
initiative_version: 1
status: complete
depends_on: none
demo_state: "Source ops (@import/@include) resolve relative to document. Data ops (@list/@read/@tree/@count/file.*) resolve relative to cwd by default, with config override. MDD shared library macros work natively (without @query workarounds) against this engine."
created: 2026-05-23
hash: ae94a3ed
---

# Wave 1: Source vs Data Root Split

## Demo-State

Source operations (`@import`, `@include`) resolve paths relative to the **document directory**.
Data operations (`@list`, `@read`, `@tree`, `@count`, `@date file=`, and the `file.exists`,
`file.isFile`, `file.isDir` helpers used in `@if` and `{{ }}` expressions) resolve relative
to a separate **data root**. Default `data_root` is the process working directory (`cwd`).
Both roots are configurable via `security.json`.

When validated: rewriting MDD's `mdd-shared.md` to use native `@list ./.mdd/docs/`,
`@read ./.mdd/settings.json path="phaseLogging"`, and `@if !file.isFile(".mdd/.startup.md")`
directives (no more `bash -c` workarounds) produces correct results against `~/projects/mdd2`
and MDD's test suite stays green.

*(This wave is not complete until this can be manually demonstrated.)*

---

## Motivation

A skill file like `~/.claude/commands/mdd.md` runs via MCP `read_file` with the user's
project as `cwd`. Today both source and data ops jail to `dirname(mdd.md)` (the install
directory). The skill cannot see the user's project files. Skill libraries (`@import`-ed
modules) inherit the same jail, so even `@if file.isFile(".mdd/.startup.md")` inside
a macro returns false against the user's actual `.startup.md`.

Result: every project-file operation in MDD's shared library routes through
`@query bash -c "..."` because the shell at least runs in `cwd`. This:
1. Defeats MarkdownAI's purpose ("Claude is the brain; MarkdownAI does the grunt work")
2. Makes the shared library ugly and fragile (shell quoting, escaping)
3. Forces shell to be enabled in security config for what should be native ops

## Concept

Two distinct contexts deserve two distinct roots:

| Context | Examples | Default root | Why |
|---------|----------|--------------|-----|
| **Source ops** | `@import`, `@include` | `dirname(entryDoc)` | Documents bundle with their includes; portable; same as today |
| **Data ops** | `@list`, `@read`, `@tree`, `@count`, `@date file=`, `file.exists`, `file.isFile`, `file.isDir` | `cwd` (process working dir) | Data ops act on the user's working context |

`@query` (shell) already uses cwd because it spawns shells; no change needed there.

`@db`, `@http` are unaffected (no filesystem jail).

## Security model

### Config (additions to `security.json`)

```json
{
  "filesystem": {
    "source_root": "auto",
    "data_root": "cwd",
    "allowed_source_paths": [],
    "allowed_data_paths": [],

    "additional_block_paths": [],
    "additional_block_patterns": [],
    "allow_unmasked_paths": [],
    "allow_unmasked_patterns": [],
    "user_masking_patterns": []
  }
}
```

Existing fields preserved. New keys:

- **`source_root`** (string): how to resolve source paths.
  - `"auto"` (default): `dirname(entryDoc)`.
  - `"cwd"`: process cwd.
  - Absolute path: pin to a specific directory (rare; useful for sandboxed builds).
- **`data_root`** (string): how to resolve data paths.
  - `"cwd"` (default): process cwd.
  - `"auto"`: `dirname(entryDoc)` (matches v1.x behavior - for users who want the old jail).
  - Absolute path: pin to a specific directory.
- **`allowed_source_paths`** (string[]): additional source paths beyond `source_root` that
  may be `@import`-ed or `@include`-d. Supports glob patterns. Supports `${VAR}` expansion
  (e.g. `${CLAUDE_SKILL_DIR}/**`).
- **`allowed_data_paths`** (string[]): additional data paths beyond `data_root` that may be
  read. Same glob + variable rules.

### Path-checking algorithm

For source ops:

```
1. Resolve path → absolute.
2. If inside source_root: ALLOW.
3. If matches any pattern in allowed_source_paths: ALLOW.
4. Otherwise: BLOCK.
```

For data ops:

```
1. Resolve path → absolute.
2. If inside data_root: ALLOW.
3. If matches any pattern in allowed_data_paths: ALLOW.
4. Otherwise: BLOCK.
```

### Immutable rules (cannot be bypassed by config)

- Path traversal via `../` is always blocked (resolved-path check).
- Symlinks pointing outside the resolved jail are not followed.
- Sensitive paths denied for ALL ops regardless of allowlist:
  `**/.env`, `**/.env.*`, `**/credentials*`, `**/*.pem`, `**/.ssh/**`.
- Cloud metadata addresses on filesystem (`/proc/self/environ` etc.) blocked.

### Variable expansion in patterns

Both `allowed_source_paths` and `allowed_data_paths` expand `${VAR}` against the current
environment AND skill context at evaluation time. Supported variables:

- `${HOME}`, any env var available to the process
- `${CLAUDE_SKILL_DIR}` (skill context)
- `${CLAUDE_SESSION_ID}` (rarely useful but supported)

Expansion happens at check time, not config-load time, so MCP-injected skill context is
honored.

## Backward compatibility

**Breaking** for documents that relied on data ops finding files in the document directory.
This is an unusual pattern (most documents either don't use data ops, or run in cwd anyway).

Migration path for affected users (rare):

```json
{
  "filesystem": {
    "data_root": "auto"
  }
}
```

This restores v1.x semantics.

`changed.md` entry must explain this in detail.

## Implementation plan

### Step 1 — Engine context

`packages/engine/src/engine.ts`:

- `EngineContext` gains `sourceRoot` and `dataRoot` fields. Today's `docDir` becomes the
  default `sourceRoot`. Today's `security.jailRoot` is split into `sourceJail` and `dataJail`.
- `execute()`:
  - Reads `filesystem.source_root` and `filesystem.data_root` from security config.
  - Resolves them to absolute paths (with `"auto"` → `dirname(mainFile)`, `"cwd"` → `process.cwd()`).
  - Stores both on `ctx`.

### Step 2 — File helpers split

`packages/engine/src/conditions.ts` and `packages/engine/src/engine-interpolate.ts`:

- `makeFileHelper(dataRoot, allowedDataPaths)` (renamed from jailRoot version).
- Each `file.exists`/`file.isFile`/`file.isDir` uses the new `confined()` against
  `dataRoot` + `allowedDataPaths`.

### Step 3 — Source ops

`packages/engine/src/includes.ts`, `imports.ts`:

- Resolve relative paths against the directive's host document (existing behavior, unchanged).
- For absolute paths (today rejected), check against `allowedSourcePaths`.

### Step 4 — Data ops

`packages/engine/src/sources.ts` (handles `@list`, `@read`, `@tree`, `@count`):

- Use `dataRoot` + `allowedDataPaths`.
- `@date file=...` shares the same data helper.

### Step 5 — Tests

`packages/engine/src/__tests__/source-data-root.test.ts`:

- Default `data_root=cwd`: `@read ./project-file.json` from a document elsewhere works.
- `data_root=auto`: legacy behavior, `@read ./doc-sibling.json` works.
- `allowed_data_paths` allows specific patterns outside default root.
- `allowed_source_paths` allows specific `@import` patterns outside source root.
- `${CLAUDE_SKILL_DIR}` expands in patterns.
- Immutable blocks: `.env`, `../`, symlink escape - all rejected.

### Step 6 — MDD validation

Rewrite `~/projects/mdd2/commands/mdd-shared.md` macros to use native directives:

```markdown
@define create-startup-if-missing
@if !file.isFile(".mdd/.startup.md")
  (will use @copy after Wave 3; for Wave 1, still uses @query)
@endif
@end

@define list-feature-docs
@list ./.mdd/docs/ match="*.md" type=files
@end

@define show-startup
@read ./.mdd/.startup.md
@end
```

Run MDD's `pnpm test` against the new engine via local link. All 51 tests stay green.

## Telemetry / change log entry (preview)

```
## YYYY-MM-DD | breaking | Split source and data jail roots

@import/@include continue to resolve relative to the document. @list/@read/@tree/@count
and the file.exists/isFile/isDir helpers now resolve relative to a new "data root", which
defaults to the process cwd. Previously they jailed to the document directory.

Why: enables shared MarkdownAI libraries imported into skill files to operate on the
user's project, not the skill install directory.

Config: filesystem.data_root (default: "cwd"), filesystem.source_root (default: "auto"),
filesystem.allowed_source_paths, filesystem.allowed_data_paths.

Migration for users who need v1.x behavior:
  { "filesystem": { "data_root": "auto" } }

Files: engine/{engine,conditions,engine-interpolate,sources,includes,imports}.ts +
security/config.ts + new tests.
```

## Open Research

- None blocking. Pattern syntax for `allowed_*_paths` should match minimatch defaults
  (already used in `additional_block_patterns`).
- Decide whether `data_root: "skill_dir"` is worth adding as a third option. Probably not -
  skill dir is reached via `${CLAUDE_SKILL_DIR}` in `allowed_data_paths` if needed.
