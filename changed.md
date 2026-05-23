# MarkdownAI Change Log

Running log of all changes on this branch. Every change appends an entry. After publishing,
this file feeds README, user guide, and website updates so docs stay accurate.

Format per entry:
- **Date** | **Category** | **Title**
- Summary
- Files touched
- Migration notes (if breaking)
- Linked issue/PR

Categories: `feature`, `bug-fix`, `breaking`, `security`, `docs`, `internal`.

---

## 2026-05-23 | branch start

Branch `feat/mdd-integration-fixes` created off main. Goal: address issues discovered while
integrating MarkdownAI into MDD (`~/projects/mdd2`). See
`~/projects/mdd2/markdownai-comments.md` for the full issue list that motivated this branch.

Target version: **v2.0.0** (breaking changes expected; we are still in early days so a clean
major bump is preferred over backward-compat shims).

Scope (Tier 1):
1. Source vs data root split — `@import`/`@include` resolve relative to document; `@list`,
   `@read`, `@tree`, `file.exists/isFile/isDir` resolve relative to a separate data root
   (default: cwd).
2. `{{ }}` interpolation inside `@query` strings, with auto shell-escaping.
3. Absolute paths in `@import`/`@include` allowed if matching configured patterns.
4. `||` operator in `@if`/`@elseif`/`@else` lines (parser fix).
5. `mai render --skill-args "..."` and related skill-context flags.
6. New file-write directives: `@copy`, `@mkdir`, `@append-if-missing`.
7. Security config additions for write directives + source/data root configuration.

Scope (Tier 2, if time):
- `{{ read ... }}` inline form parity with documented behavior.
- `mai validate` auto-loads stdlib.
- `*.json` SECURITY_ALERT suppression on non-credential reads.

---

(entries below this line as fixes land)

---

## 2026-05-23 | breaking + feature | Source vs Data Root Split (Wave 1)

Split MarkdownAI's single path jail into two distinct contexts:

- **Source ops** (`@import`, `@include`) jail to `source_root` (default: `auto` =
  dirname of entry document). Same as v1.x behavior.
- **Data ops** (`@list`, `@read`, `@tree`, `@count`, `@date file=`, `file.exists`,
  `file.isFile`, `file.isDir`) jail to `data_root` (default: `cwd` = process
  working directory). **This is a breaking change** — v1.x jailed all data ops
  to the document directory.

### Why

A skill file installed at `~/.claude/commands/mdd.md` invoked via MCP `read_file`
runs with `cwd` = user's project. With v1.x, `@list ./project-files` from such
a skill jailed to the install directory — the skill could not see the user's
project. v2.0 splits the contexts so source loading stays portable (document
directory) but data access follows the working context (cwd by default).

### Config

```json
{
  "filesystem": {
    "source_root": "auto",        // "auto" | "cwd" | <absolute path>
    "data_root": "cwd",           // "cwd"  | "auto" | <absolute path>
    "allowed_source_paths": [],   // extra patterns beyond source_root
    "allowed_data_paths": []      // extra patterns beyond data_root
  }
}
```

Patterns in `allowed_*_paths` support glob (`**`, `*`) and `${VAR}` substitution.
Supported variables: `${HOME}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`,
plus any process env var. Expansion happens at check time.

### Security model

- Immutable rules (`.env`, `**/.ssh/**`, `*.pem`, path traversal, etc.) apply
  to both source and data ops regardless of allowlists. Cannot be bypassed.
- `allowed_*_paths` only relaxes the jail boundary — never overrides immutable
  blocks.
- Variable expansion resolves to the empty string for unset vars (conservative
  fail-closed: the empty-prefix path almost never matches).

### Migration

For users who want v1.x behavior (data ops jailed to document dir):

```json
{ "filesystem": { "data_root": "auto" } }
```

For users with skill files operating on a separate project (the common new use
case): no config needed. The default `data_root: "cwd"` does the right thing.

### MDD integration validated

MarkdownAI's MDD shared library (`~/projects/mdd2/commands/mdd-shared.md`) was
rewritten to replace `@query bash -c "..."` workarounds with native directives
(`@list`, `@read`). MDD's 51-test suite stays green against the new engine.

### Files touched

- `packages/engine/src/security/config.ts` — added `source_root`, `data_root`,
  `allowed_source_paths`, `allowed_data_paths` to `FilesystemSecurityConfig`
- `packages/engine/src/security/filesystem.ts` — added `checkSourcePath`,
  `checkDataPath` (legacy `checkFilePath` kept for stripper)
- `packages/engine/src/security/path-expand.ts` — new: ${VAR} expansion for
  allow-list patterns
- `packages/engine/src/context.ts` — added `sourceJail`, `dataJail`,
  `allowedSourcePaths`, `allowedDataPaths` to `SecurityConfig`
- `packages/engine/src/engine.ts` — new `resolveJailRoots()` derives jails from
  config at execute()
- `packages/engine/src/conditions.ts` — `file.*` helpers use `dataJail`
- `packages/engine/src/engine-interpolate.ts` — `{{ file.* }}` helpers use `dataJail`
- `packages/engine/src/engine-include.ts` — `@import` / `@include` use `sourceJail`
- `packages/engine/src/sources.ts` — `@list` / `@read` / `@tree` / `@count` /
  `@date file=` / mock paths use `dataJail`
- `packages/mcp/src/tools/read_file.ts` — passes `cwd` explicitly so dataJail
  resolves correctly
- `packages/engine/src/__tests__/source-data-root.test.ts` — new: 12 tests
  covering default behavior, allowlists, ${VAR} expansion, immutable rules,
  legacy mode

---

## 2026-05-23 | bug-fix + feature | Wave 2 — Parser fix, --skill-args, absolute imports

Four targeted fixes for issues that surfaced while integrating MarkdownAI into MDD:

### bug-fix | `||` in `@if` conditions misclassified as pipe

The parser's pipe detection split lines on every `|` outside double-quotes,
breaking `@if A == 1 || B == 2`. Updated `splitUnquotedPipe()` in
`packages/parser/src/directives/pipe.ts` to:
- Treat `||` as a single non-pipe token
- Recognize single-quoted strings (in addition to existing double-quote handling)
- Skip `|` inside `{{ }}` interpolations

No API change. Pure bug fix. 7 new tests in `parser-pipes.test.ts`.

### feature | `mai render --skill-args` (and related CLI flags)

Adds CLI flags so skill files can be tested locally without spinning up the MCP
server. Mirrors the `read_file` MCP tool's skill_* parameters:

```
mai render mdd.md --skill-args "audit foo" --skill-dir ~/.claude/commands
mai render mdd.md --skill-args "build" --skill-effort high
mai render mdd.md --skill-session-id <id>
```

When `--skill-args` is set, the CLI also defaults `filesystem.data_root` to
`"cwd"` (skill mode) so data ops jail to the user's project. Without
`--skill-args`, the CLI keeps `data_root: "auto"` (dirname of doc) — backward
compatible with v1.x render behavior.

Side fix: `evalExpr()` in `engine-interpolate.ts` now exposes skill context
variables (`ARGUMENTS`, `arg0..arg3`, `argsList`, `CLAUDE_*`) in `{{ }}`
interpolations. Previously only the `@if` condition sandbox had them.

### feature | Absolute paths in `@import` / `@include` via `allowed_source_paths`

The Wave 1 split already wired through the allowlist. Wave 2 verifies it with
4 new tests in `source-data-root.test.ts`:
- Allowed absolute import succeeds when matching `allowed_source_paths`
- Same path blocked when no allowlist entry matches
- `${CLAUDE_SKILL_DIR}` expansion works
- Immutable blocks (e.g. `.env`) cannot be bypassed even with broad allowlist

### internal | Default split: CLI `auto`, MCP `cwd`

Removed engine-level defaults for `source_root` / `data_root` (now optional
fields). The CLI (`runRender`) defaults to `auto` for both, MCP `read_file`
sets both explicitly. This restores v1.x ergonomics for plain `mai render
foo.md` while still giving skill mode the cwd-as-data-root behavior MDD needs.

### Files touched

- `packages/parser/src/directives/pipe.ts` — `splitUnquotedPipe()` rewrite
- `packages/parser/src/__tests__/parser-pipes.test.ts` — 7 new `||` tests
- `packages/core/src/commands/render.ts` — `--skill-args` / `--skill-dir` /
  `--skill-session-id` / `--skill-effort` options; mode-aware `data_root` default
- `packages/core/src/cli.ts` — Commander flag definitions
- `packages/engine/src/engine-interpolate.ts` — skill context in `{{ }}`
  interpolation sandbox
- `packages/engine/src/security/config.ts` — `source_root`, `data_root` made
  optional (defaults pushed to callers)
- `packages/mcp/src/tools/read_file.ts` — explicit `data_root: "cwd"` in
  filesystemConfig
- `packages/engine/src/__tests__/source-data-root.test.ts` — 4 new
  absolute-import tests (16 total)

### MDD integration check

- `~/projects/mdd2/commands/mdd.md` — dropped `(env.ARGUMENTS ?? ARGUMENTS)`
  fallback (just `ARGUMENTS`), collapsed 23 `@elseif` branches back into grouped
  `||` conditions
- `~/projects/mdd2/tests/helpers.ts` — uses `--skill-args` / `--skill-dir`
  flags instead of writing temp `.env` files
- `~/projects/mdd2/package.json` — removed `@markdownai/core` devDep so tests
  use the globally-linked binary
- MDD's 51-test suite stays green

### Deferred to a future release

- `@query` `{{ }}` interpolation with shell-escape (markdownai-comments.md #1).
  MDD does not use this pattern (uses `$CLAUDE_SKILL_DIR` shell expansion). The
  shell-aware tokenizer required for safe interpolation deserves its own PR.

---

## 2026-05-23 | feature | Wave 3 — Write Directives (@mkdir, @copy, @append-if-missing)

Adds three native write directives so bootstrap-style operations no longer need
`@query bash -c "..."` wrappers. All three go through a shared security gate
(`filesystem.write_enabled` + `write_root` + `allowed_write_paths` + immutable
rules).

### New directives

**`@mkdir`**

```
@mkdir .mdd
@mkdir path=".mdd/docs"
@mkdir .mdd/audits recursive=false
```

Default recursive. Creates the destination if it does not exist; no-op if it
does.

**`@copy`**

```
@copy from="./tpl.md" to=".mdd/file.md"
@copy from="${CLAUDE_SKILL_DIR}/templates/x.md" to=".mdd/x.md" if-missing
```

- `from=` resolves via the **data jail** (read access)
- `to=` resolves via the **write jail** (write access)
- `if-missing` bare flag: skip the copy when `to=` already exists (idempotent
  bootstrap)
- Auto-creates parent directories of `to=` if absent

**`@append-if-missing`**

```
@append-if-missing path=".gitignore" text=".mdd/audits/"
```

Appends `text=` to `path=` only if the file does not already contain `text=`.
Idempotent. No-op if the target file does not exist (does NOT create it; use
`@copy` to seed a new file).

### Security model

New `FilesystemSecurityConfig` fields:

```json
{
  "filesystem": {
    "write_enabled": false,          // master gate — default off
    "write_root": "cwd",             // "cwd" | "auto" | absolute
    "allowed_write_paths": []        // extra patterns w/ ${VAR} expansion
  }
}
```

- `write_enabled: false` is the default. All three directives no-op with a
  warning until the user opts in.
- Write paths must be inside `write_root` OR match `allowed_write_paths`.
- Immutable always-block rules (`.env`, `.env.*`, `**/.ssh/**`, `**/credentials*`,
  `*.pem`, etc.) apply regardless of allow-list. Cannot be bypassed.
- Path traversal (`../`) always blocked.
- `@copy from=` path goes through the data-op jail (separate from write jail)
  with `allowed_data_paths` honored.

### Side change: `*.json` no longer always-alerts (item #6)

Removed `*.json` from `FILESYSTEM_ALWAYS_ALERT_PATTERNS`. The pattern produced
SECURITY_ALERT warnings on every `package.json` / `tsconfig.json` /
`settings.json` access — pure noise. Credentials JSON files are caught by the
always-block list (`*credentials*`, `*.token`, etc.).

### MDD integration check

`mdd-shared.md` bootstrap macros rewritten to use native directives:

```markdown
@define bootstrap-dirs
@mkdir .mdd
@mkdir .mdd/docs
@mkdir .mdd/audits
...
@end

@define create-startup-if-missing
@copy from="${CLAUDE_SKILL_DIR}/templates/startup.md" to=".mdd/.startup.md" if-missing
@end

@define ensure-gitignore
@append-if-missing path=".gitignore" text=".mdd/audits/"
@append-if-missing path=".gitignore" text=".mdd/jobs/"
@end
```

All 51 MDD tests pass. No more `@query bash -c "..."` in any bootstrap macro.

### Files touched

- `packages/parser/src/types.ts` — `MkdirNode`, `CopyNode`, `AppendIfMissingNode`
- `packages/parser/src/directives/mkdir.ts` — new
- `packages/parser/src/directives/copy.ts` — new; also handles bare-flag args
  like `if-missing` as `args["if-missing"] = "true"`
- `packages/parser/src/directives/append-if-missing.ts` — new
- `packages/parser/src/registry.ts` — registered all three
- `packages/engine/src/write-ops.ts` — new: `executeMkdir`, `executeCopy`,
  `executeAppendIfMissing`
- `packages/engine/src/engine.ts` — dispatch the three new node types; resolve
  `writeJail` / `allowedWritePaths` / `writeEnabled` in `resolveJailRoots()`
- `packages/engine/src/context.ts` — `SecurityConfig` gains write-jail fields
- `packages/engine/src/macros.ts` — `substituteNode` cases for new nodes
- `packages/engine/src/security/filesystem.ts` — new `checkWritePath()`
- `packages/engine/src/security/config.ts` — `write_enabled`, `write_root`,
  `allowed_write_paths` in `FilesystemSecurityConfig`
- `packages/engine/src/security/rules.ts` — `*.json` removed from alert list
- `packages/engine/src/__tests__/write-ops.test.ts` — new: 14 tests
- `packages/engine/src/__tests__/security-filesystem.test.ts` — updated
  `*.json` test to expect `allowed`

### Test totals

- engine: 576 (was 558 + 14 new write-ops + 4 added in absolute-import = 576)
- parser: 160
- core: 93
- mcp: 37
- mdd: 51
- **total: 917**

---

## 2026-05-23 | feature | Wave 4 — Read symmetry, exec directives, hashing, section helpers

Six new building blocks that fill in the asymmetries left by Wave 3. Each is small in
isolation but together they remove the last few classes of prose / shell that MDD mode
files needed.

### `@read-frontmatter path="..." field="..." [label=...]`

Read-side counterpart to `@update-frontmatter`. Top-level scalar fields return the trimmed
value; YAML lists (inline or block) return a comma-joined string of items. Missing field
returns empty (no warning). Missing file or missing frontmatter warns. Data-jail security.

```
@read-frontmatter path=".mdd/docs/01-mdd.md" field="status" label=s
@if {{ s }} == "complete"
  ...
@endif
```

Refactor: extracted the YAML frontmatter parsing helpers from `write-ops.ts` into a new
`frontmatter-utils.ts` so both directives share them.

### `@render-template from="..." to="..." [force] + key=value body`

Block directive. Reads a MarkdownAI template via the data-jail, parses it with the in-process
parser, renders in a child engine context with `key=value` body lines injected as variables,
then writes the result (sans the `@markdownai` header line) to `to=` via the write-jail.

```
@render-template from="${CLAUDE_SKILL_DIR}/templates/tests/unit.test.ts.template" \
                 to="tests/unit/user-auth.test.ts"
  feature_name=user-auth
  has_endpoints=true
@end
```

- Idempotent: skips if destination exists. `force` flag overwrites.
- Plain-text templates (no `@markdownai` header) get simple `{{ key }}` substitution.
- `@if {{ key }} == "..."` conditionals inside the template work as expected because params
  are injected as engine envFiles.
- Circular-import between engine and exec-ops is broken via a deferred `setEngineExecute`
  call from `engine.ts` at module-init time.

### `@test [command="..."] [label=...] [budget=N]`

Runs the project's test suite. Auto-detects from `package.json` -> `scripts.test` when
`command=` is absent. Recognizes vitest / jest / playwright / node --test output for clean
one-line summaries on success; on failure tails the last `budget` (default 80) lines.

Stores into `{{ label }}` the summary, `{{ label_exit }}` the numeric exit code, and
`{{ label_output }}` the raw (success summary or failure tail). Same shell allow-pattern
gating as `@query`. 5-minute timeout (test suites can be slow).

### `@check [command="..."] [label=...] [budget=N]`

Analogue of `@test` for non-test runners. Auto-detect priority:
`typecheck > check > lint > build`. Recognizes tsc / eslint / prettier output shapes.
Same gating and labeling as `@test`.

### `@hash path="..." [algo=sha256] [length=N] [exclude-line=regex] [label=...]`

Computes a content hash via `crypto.createHash`. `algo=` supports any algo node accepts
(`sha256`, `sha1`, `md5`). `length=` truncates the hex digest. `exclude-line=` strips
matching lines before hashing -- required for the self-referencing `hash:` field pattern
in wave/initiative docs.

Replaces `@query bash -c "grep -v '^hash:' file | sha256sum | cut -c1-8"` which is fragile
on macOS (no `sha256sum` without coreutils).

### `file.containsLine(path, regex)` and `file.containsSection(path, heading)`

Two new helpers in the `@if` expression sandbox alongside the existing `file.exists` /
`file.isFile` / `file.isDir`.

- `file.containsLine(path, regex)` -- multiline regex test against the file's full content.
- `file.containsSection(path, heading)` -- matches an ATX heading on its own line. If the
  argument starts with `#`s (`"## Bugs"`) it matches only that level; without `#`s
  (`"Bugs"`) it matches any heading level. Mid-line occurrences do NOT match.

Resolves the `## Bugs` section-presence dispatch in `mdd-bug.md` and `mdd-security-rules.md`
without prose.

### Security

All six follow the established security model:
- Read directives use the data-jail (`allowed_data_paths` + immutable rules).
- `@render-template` write goes through the write-jail (`write_enabled` + `allowed_write_paths`
  + immutable rules).
- `@test` / `@check` require `shell.enabled: true` AND match a `shell.allow_patterns` entry.
- No directive can bypass the immutable always-block list (`.env`, `**/.ssh/**`, etc.).

### Files touched

- `packages/parser/src/types.ts` -- `ReadFrontmatterNode`, `RenderTemplateNode`, `TestNode`,
  `CheckNode`, `HashNode`
- `packages/parser/src/directives/{read-frontmatter,render-template,test,check,hash}.ts` -- new
- `packages/parser/src/registry.ts` -- register 5 new modules
- `packages/parser/src/parser-blocks.ts` -- `parseRenderTemplateBlock`
- `packages/parser/src/parser.ts` -- dispatch `render-template` to its block parser
- `packages/engine/src/frontmatter-utils.ts` -- new shared module factored out of write-ops
- `packages/engine/src/write-ops.ts` -- use the shared helpers for @update-frontmatter
- `packages/engine/src/read-ops.ts` -- new: `executeReadFrontmatter`, `executeHash`
- `packages/engine/src/exec-ops.ts` -- new: `executeTest`, `executeCheck`,
  `executeRenderTemplate`, `setEngineExecute`
- `packages/engine/src/engine.ts` -- register 5 new node dispatches; inject
  `setEngineExecute(execute, parse)` at module load to break the circular import
- `packages/engine/src/macros.ts` -- `substituteNode` cases for 5 new node types
- `packages/engine/src/conditions.ts` -- `file.containsLine` / `file.containsSection`
  helpers in the `@if` sandbox
- `packages/engine/src/__tests__/{read-frontmatter,render-template,hash,test-check,file-helpers-contains}.test.ts` -- new: 37 tests across 5 files

### Test totals

- engine: 619 (was 582; +37 new tests across the 5 new files)
- parser: 160 (unchanged -- the new parser modules are minimal arg-parsers and don't need
  new tests beyond the engine integration coverage)
- core: 93
- mcp: 37
- mdd: 51 (verified green with rebuilt mai binary)
- **total: 960**

### Migration notes

Non-breaking. All six additions are opt-in:
- `@read-frontmatter` is read-only -- no security config changes needed.
- `@render-template` requires `filesystem.write_enabled: true` (same as Wave 3 directives).
- `@test` / `@check` require `security.shell.enabled: true` and matching `allow_patterns`.
- `@hash` is read-only.
- `file.containsLine` / `file.containsSection` are pure helpers in the `@if` sandbox.

---

## 2026-05-23 | feature | Wave 5 Part A — Iteration, value-binding, list-addressing, frontmatter-helper

Four primitives required for the MDD Wave 5 conversion (mode files lose their
remaining "for each", "if ... then update field", "read this list and check"
prose — see `~/projects/mdd2/wave-5-grunt-elimination` plan).

### `@foreach <var> in <source>`

Block directive that iterates a list source. Source can be any directive
returning lines (`@list`, `@read`, `@query`), a list-typed
`@read-frontmatter` field, a `{{ label }}` interpolation, or a comma-separated
literal. Each iteration binds `ctx.envFiles[<var>]` to the current item and
runs `substituteParams` on the body so `{{ <var> }}` substitutes into nested
directive args (e.g. `@read-frontmatter path="{{ doc }}"`). Outer bindings
restore after the loop ends; nested foreach works.

### `@set <var> = <expression>`

Inline directive that binds `<var>` to the result of the right-hand side.
Supports literal strings (auto-unquoted), directive invocations
(`@set today = @date format="YYYY-MM-DD"`), and `{{ }}` interpolations.
Equivalent in spirit to the existing `label=` on source directives but works
for cases where the RHS isn't a single directive (concatenation, literal,
ternary).

### `@update-frontmatter field="list[N].sub"` / `field="list[append]"`

Extended `@update-frontmatter` to address block-list items by index and to
append new items. Examples:

```
@update-frontmatter path="doc.md" field="tags[append]"               value="new-tag"
@update-frontmatter path="doc.md" field="tags[1]"                    value="emerald"
@update-frontmatter path="doc.md" field="satisfies_contracts[0].status" value="done"
@update-frontmatter path="doc.md" field="known_issues[append]"       value="bug X"
```

Creates the field if absent for `[append]`. Bounds-warns on `[N]` for an
out-of-range index. Only block-list YAML is supported (no inline list mutation
except the special case of `field: []` for `[append]`). The `[N].sub` form
replaces (or adds) a sub-field on the indexed block-mapping item.

### `file.frontmatterField(path, field)` helper

New helper in the `@if` expression sandbox. Returns the field's value (string),
empty string if missing or file absent. Allows inline conditionals without a
separate `@read-frontmatter ... label=` line:

```
@if file.frontmatterField(".mdd/docs/01-mdd.md", "status") == "complete"
  ...
@endif
```

### Files touched

- `packages/parser/src/types.ts` -- `ForeachNode`, `SetNode`
- `packages/parser/src/directives/foreach.ts` -- new
- `packages/parser/src/directives/set.ts` -- new
- `packages/parser/src/registry.ts` -- register both
- `packages/parser/src/parser-blocks.ts` -- `parseForeachBlock`
- `packages/parser/src/parser.ts` -- dispatch `foreach` to block parser
- `packages/engine/src/iter-ops.ts` -- new: `executeForeach`, `executeSet`,
  `setIterEngine` (deferred engine pointer, mirroring exec-ops's pattern)
- `packages/engine/src/engine.ts` -- dispatch `foreach`/`set`; inject
  `setIterEngine(walkNodes, resolveInterpolations)` at module init
- `packages/engine/src/macros.ts` -- `substituteNode` cases for `foreach` /
  `set` (substitutes `literalSource` / `literalExpr` and recursively
  substitutes body of foreach so inner uses of macro params resolve)
- `packages/engine/src/write-ops.ts` -- `updateListField()` helper for
  list-index addressing; routed from `executeUpdateFrontmatter`
- `packages/engine/src/conditions.ts` -- `file.frontmatterField(path, field)`
  in the sandbox alongside `file.exists` / `isFile` / `isDir` / `containsLine` /
  `containsSection`
- `packages/engine/src/__tests__/foreach.test.ts` -- new: 9 tests
- `packages/engine/src/__tests__/set.test.ts` -- new: 7 tests
- `packages/engine/src/__tests__/update-frontmatter-list.test.ts` -- new: 7 tests
- `packages/engine/src/__tests__/file-frontmatter-helper.test.ts` -- new: 4 tests
- `packages/engine/src/__tests__/test-check.test.ts` -- updated ShellSecurityConfig
  test fixtures to include `allow_network` / `require_confirmation` (added
  upstream since Wave 4 but the older fixtures still passed via tsbuildinfo
  caching; this commit forces a clean check)

### Test totals

- engine: 646 (was 619; +27 across the four new files)
- parser: 160
- core: 93
- mcp: 37
- mdd: 51 (verified green with rebuilt mai binary)
- **total: 987**

### Migration notes

Non-breaking. All four additions are opt-in. Existing `@update-frontmatter`
calls with scalar `field=` work exactly as before — list-index syntax only
activates when `field=` matches the `name[N].sub` or `name[append]` pattern.

---

## 2026-05-23 | bug-fix | Source directive `label=` now captures multi-line output

Discovered during the MDD Wave 5 parity audit (`~/projects/mdd2` against
`~/projects/mdd`). `mdd-shared.md`'s new `detect-stack` macro needed to
read `package.json`'s `devDependencies` into a label and run substring
tests against it. `@read ./package.json path="devDependencies" label=deps`
captured only the first dependency name; the rest was discarded.

### Root cause

`engine.ts` walked all source directives (`@list`, `@read`, `@tree`,
`@count`, `@date`, `@db`, `@http`, `@query`) through one dispatch:

```javascript
if (label) ctx.envFiles[label] = lines[0]?.trim() ?? ''   // FIRST line only
return lines.join('\n')
```

The first-line-only behavior makes sense for scalar-shaped directives
(`@count`, `@date`) but loses information for multi-line ones (`@read`,
`@list`, `@tree`, `@query`, `@db`, `@http`).

### Fix

Branch by node type. Scalar-shaped sources keep `lines[0]?.trim()`. The rest
store `lines.join('\n').trim()` so the label carries the full output for
substring tests, `String.includes()`, `@foreach` source expressions, etc.

```javascript
const scalarShaped = node.type === 'count' || node.type === 'date'
ctx.envFiles[label] = scalarShaped
  ? (lines[0]?.trim() ?? '')
  : lines.join('\n').trim()
```

### Files touched

- `packages/engine/src/engine.ts` — the dispatch case at `walkNodeCore`'s
  list/read/tree/count/date/db/http/query branch.
- `packages/engine/src/__tests__/source-label-multiline.test.ts` — new: 6
  regression tests covering both behaviors and the @foreach interaction.

### Test totals

- engine: 652 (was 646; +6 new tests)
- parser: 160
- core: 93
- mcp: 37
- mdd: 51
- **total: 993**

### Migration notes

Behavior change for callers that relied on the first-line-only semantic for
`@read` / `@list` / `@tree` / `@query` / `@db` / `@http` `label=` captures.
Search the codebase for `@<source> ... label=` patterns and confirm none
depend on the old truncated behavior. Within this repo no callers depended
on it; the Wave 4 / Wave 5 directive tests pass unchanged.

### Linked MDD site

`~/projects/mdd2/commands/mdd-shared.md` → the `detect-stack` macro
(which would otherwise have to fall back to bash-via-`@query`). Documented
in `~/projects/mdd2/markdownai-comments.md` under "Still Open (engine
bugs surfaced during Wave 5 parity verification)" — marked resolved by
this commit.
