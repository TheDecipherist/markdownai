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

`~/projects/mdd2/commands/mdd-shared.md` -> the `detect-stack` macro
(which would otherwise have to fall back to bash-via-`@query`). Documented
in `~/projects/mdd2/markdownai-comments.md` under "Still Open (engine
bugs surfaced during Wave 5 parity verification)" - marked resolved by
this commit.

---

## 2026-05-23 | bug-fix | @include and @import expand ${VAR} placeholders

Surfaced during MDD Wave 6 when mdd-plan.md tried to include the bundled
initiative / wave / manifest templates via `@include ${CLAUDE_SKILL_DIR}/templates/...`.
The path was treated as a literal, producing ENOENT against
`<docDir>/${CLAUDE_SKILL_DIR}/templates/initiative.md`. Skill-dir-relative
templates were the entire point of bundling them, so this was a real gap.

### Root cause

`engine-include.ts` ran `node.path` straight through `resolve()` without
calling `expandPattern()`. The write directives (@copy, @mkdir,
@append-if-missing, @update-frontmatter) already expanded the same set;
@include and @import had been overlooked.

### Fix

Added `expandImportPath()` helper in `engine-include.ts` that builds a
`PatternExpandContext` from `ctx.env`, `ctx.envFiles`, and
`ctx.skillContext` and runs `expandPattern()` on the raw path. The
expansion happens BEFORE the security-jail check, so an expanded path
that lands outside the source jail still has to be in `allowed_source_paths`
to load. Conservative fail-closed semantics for unset variables match the
write-directive convention.

### Files touched

- `packages/engine/src/engine-include.ts` - new `expandImportPath()` helper;
  both `executeImport()` and `executeInclude()` now expand before resolving.
- `packages/engine/src/__tests__/include-import-skill-dir.test.ts` - new: 4
  regression tests covering @include with `${CLAUDE_SKILL_DIR}`, @import
  with `${CLAUDE_SKILL_DIR}`, the unset-variable fail-closed path, and the
  relative-path parity case.

### Test totals

- engine: 656 (was 652; +4 new tests)
- parser: 160
- core: 93
- mcp: 37
- mdd: 51
- **total: 997**

### Migration notes

Non-breaking. Existing relative and allowed-absolute paths work
identically. The new behavior only activates when the path contains a
`${VAR}` placeholder, which previously failed outright.

### Linked MDD site

`~/projects/mdd2/commands/mdd-plan.md` Phase PI3 (`@include
${CLAUDE_SKILL_DIR}/templates/initiative.md`), Phase PW4
(`@include ${CLAUDE_SKILL_DIR}/templates/wave.md`), Phase PE2
(`@include ${CLAUDE_SKILL_DIR}/templates/wave-manifest.md`). All three
sites now route their inline doc skeleton through the bundled template
instead of duplicating the content in-line.

---

## 2026-05-23 | bug-fix (correctness) | @test and @check now return the FULL runner output

### The bug

Wave 4 shipped `@test` and `@check` with two truncation behaviors:

- **On success:** `runCommand()` returned only the one-line recognizer summary
  (e.g. `tests: 8 passed (8) - exit 0`). The runner's actual stdout was
  discarded.
- **On failure:** `runCommand()` returned `tailLines(combined, budget)` -
  default last 80 lines. Anything earlier in the output was dropped.

Both behaviors are wrong. Surfaced during MDD Wave 6 review of the audit
fix loop.

### The principle (now an invariant)

Engine-pre-execution of grunt work and engine-side filtering of grunt
output are different things:

- Pre-executing deterministic work (file reads, frontmatter parses, test
  runs, hashes) is the entire point of MarkdownAI. Token savings and
  speedup compound.
- Filtering or summarizing the *result* on the way back to the caller is
  not. A truncated stack trace can omit the assertion line. A summary-only
  success line can hide a runner warning. The caller cannot ask for
  the rest - there is no fallback. Wrong fix > slower fix; chaos is the
  worst outcome.

The engine runs the grunt and returns the full result. Period. Especially
on errors. Anything more clever is a foot-gun the caller cannot work
around.

### The fix

`runCommand()` now returns `{ output: <full combined stdout+stderr>,
summary: <best-effort recognizer line>, exit: <code> }`. No tailing. No
substitution.

`executeTest()` and `executeCheck()`:

- Emit the FULL output inline (where the directive sat in the rendered
  document) so the caller reads exactly what the runner produced.
- Set `{{ label }}` = full output.
- Set `{{ label_exit }}` = exit code (scalar).
- Set `{{ label_summary }}` = optional recognizer summary, additive only
  (was previously `{{ label }}` and conflated with the actual output).
- Drop `{{ label_output }}` - it's just `{{ label }}` now.
- Drop the `budget=` argument - there's nothing to budget when output is
  always full.

### Files touched

- `packages/engine/src/exec-ops.ts` - removed `tailLines()`; `runCommand`
  signature simplified; `executeTest` / `executeCheck` emit full output
  inline; label conventions rewritten in comments.
- `packages/engine/src/__tests__/test-check.test.ts` - updated the
  success-summary assertion to use `{{ t_summary }}` (renamed); added
  two regression tests: "returns the full runner output verbatim"
  (echo three lines, assert all three present) and "full output is
  emitted inline at the directive position" (assert content lands
  between START / END markers in the rendered document).

### Test totals

- engine: 658 (was 656; +2 new)
- parser: 160
- core: 93
- mcp: 37
- mdd: 51
- **total: 999**

### Migration notes

Breaking for any caller that read `{{ label }}` expecting a summary line
or `{{ label_output }}` expecting full output. Both collapse into
`{{ label }}` = full output now. `{{ label_summary }}` is the new home
for the one-line recognizer output. Callers that depended on the
truncated tail-N behavior will now see the full output (longer but
correct). `budget=` argument silently ignored.

This is a **correctness fix** and is intentional. There is no
backwards-compat path; the previous behavior was lossy by design and that
design was wrong.

### Linked MDD site

`~/projects/mdd2` audit fix loop and build phases that referenced
`{{ <label>_output }}` and `{{ <label> }}` summary text need a small
rewrite to drop `_output` and rename `{{ label }}` references where the
intent was the summary line specifically. Tracked separately on the
MDD side.

---

## 2026-05-23 | bug-fix + feature | Ironclad PreToolUse hook + cwd-aware resolvePhase + MCP phase-rendering invariant tests

Three correctness fixes that close the loop on the "Claude never sees a
directive" invariant.

### 1. PreToolUse hook: YAML-aware detection + complete tool catalogue

The `mai init` PreToolUse hook (`packages/core/src/commands/init.ts`) had
two gaps that left a bypass open:

- **Detection only matched bare `@markdownai` at line 0.** Files with
  leading YAML frontmatter (`---\n...\n---\n@markdownai`) - the standard
  Claude Code slash-command shape - slipped through. MDD's `mdd.md` entry
  point uses exactly this pattern, so Claude could `Read` it directly and
  see the unrendered source.
- **Block message was one unhelpful line:** `Use the markdownai MCP tool
  to read this file.` Claude had to guess which tool, what args, what
  order.

Fix: new `isMarkdownAIDocument()` pure function (exported for unit tests)
that walks past an optional leading `---...---` frontmatter block and
requires the next non-blank line to start with `@markdownai`. Mirrors the
parser's own frontmatter handling.

Message: rewritten as a self-contained catalogue of every MCP tool (all 9
- list_phases, resolve_phase, next_phase, read_file, execute_directive,
call_macro, get_constraints, get_env, invalidate_cache) with the exact
`args:` / `returns:` shapes and a "use this when" line per tool, plus a
5-step typical workflow. Exported as `REDIRECT_MESSAGE` so tests can
assert its contents.

The HOOK_SCRIPT template literal embeds `REDIRECT_MESSAGE` via
`JSON.stringify(...)` so we don't have to escape nested backticks.
HOOK_SCRIPT is now exported too so tests can spawn it without touching
the user's real `~/.markdownai/hooks/` directory.

22 new tests in `packages/core/src/__tests__/init-hook.test.ts`:
- 9 detection tests (bare header, frontmatter+header, padded, plain
  markdown, mid-doc mention, unclosed frontmatter, empty file)
- 5 message-shape tests (every MCP tool name present, resolve_phase
  flagged as PRIMARY, "why blocked" rationale, workflow numbered steps,
  no-retry instruction)
- 8 spawn integration tests (blocks bare-header `.md`, blocks
  frontmatter+header `.md`, allows plain `.md`, allows Edit on MDAI
  files, allows non-`.md` reads, handles missing tool_input, handles
  missing file, handles MCP-style `read_file` tool name)

### 2. resolvePhase now passes `cwd` into engine context

`packages/mcp/src/tools/resolve_phase.ts` called `execute(ast, { ctx: {
envFiles, phase } })` without setting `ctx.cwd`. The engine fell back to
`process.cwd()` (mai-serve's own working directory), so data ops -
`@list`, `@read`, `@read-frontmatter`, `file.isFile`, `file.isDir`,
`file.containsLine`, `file.containsSection`, `file.frontmatterField` -
jailed against the wrong root. A `file.isFile("foo")` from a phase in
project X would check against the server's directory Y, never finding
the file even when it exists in X.

Fix: one-line change to set `ctx.cwd: cwd` so data ops jail against the
project root the MCP client passed in the `cwd` arg. This is also what
every other tool (`call_macro`, `execute_directive`) already did;
`resolvePhase` had been overlooked.

### 3. MCP phase-rendering invariant tests

New `packages/mcp/src/__tests__/phase-rendering.test.ts` (15 tests)
asserts the receiving end of the invariant: when `resolve_phase` is
called, every directive in the phase body fires and the rendered
`content` contains zero `@directive` syntax. Coverage:

- `list_phases` returns every phase name + transitions
- `@date` / `@count` / `@read-frontmatter` / `@set` / `@call` substitute
  inline via `label=` + `{{ var }}`
- `@if` collapses to only the matching branch
- `@foreach` unrolls the body and removes all loop syntax from output
- Mixed-directive phase (`@date` + `@count` + `@read-frontmatter` +
  `@foreach` + `@if`) all fire in one render
- Phase isolation (only the requested phase's body, never another)
- The zero-directive-syntax invariant: a maximalist phase using 8
  directives renders with zero `@date / @count / @set / @if / @else /
  @elseif / @endif / @foreach / @read-frontmatter / @list` markers in
  the output
- `next_phase` follows `@on complete -> @phase <name>` transitions

### Files touched

- `packages/core/src/commands/init.ts` - YAML-aware detection,
  REDIRECT_MESSAGE constant, HOOK_SCRIPT now uses isMarkdownAIDocument
  function and JSON.stringify-embedded message; HOOK_SCRIPT,
  REDIRECT_MESSAGE, and isMarkdownAIDocument exported.
- `packages/core/src/__tests__/init-hook.test.ts` - new: 22 tests.
- `packages/mcp/src/tools/resolve_phase.ts` - one-line cwd-piping fix.
- `packages/mcp/src/__tests__/phase-rendering.test.ts` - new: 15 tests.

### Test totals

- parser: 160 (unchanged)
- engine: 658 (unchanged)
- core: 115 (was 93; +22 hook tests)
- mcp: 52 (was 37; +15 phase-rendering tests)
- mdd: 51 (verified green)
- **total: 1036** (was 999)

### Migration notes

Non-breaking for existing callers. The resolvePhase change makes data ops
behave correctly when they previously silently failed; any caller that
relied on the bug (data ops against mai-serve's cwd instead of the
project cwd) was almost certainly broken anyway. The hook change is
strictly more restrictive - it now blocks files it previously let
through - but the previous behavior was the bug.

### Linked MDD site

`~/projects/mdd2/commands/mdd.md` - the file the hook previously failed
to detect because of its YAML frontmatter. With this fix in place, direct
`Read` on it now returns the full MCP tool catalogue.

---

## 2026-05-23 | feature | SessionStart hook: render `CLAUDE.md.mai` -> `CLAUDE.md` before session init

CLAUDE.md is loaded by Claude Code's session init (as system-prompt
content), not by Claude's tool calls. That means the PreToolUse hook
shipped earlier today cannot pre-render directives in CLAUDE.md - by the
time Claude has access to its tools the file is already in the prompt.
But CLAUDE.md is exactly the place that benefits most from live data
(current branch, today's date, the active feature inventory, etc.). So
mai now ships a second hook on the `SessionStart` lifecycle.

### Convention

The user maintains a source file at `<project>/CLAUDE.md.mai` containing
MarkdownAI directives. The hook fires before session init, runs
`mai render CLAUDE.md.mai`, and writes the output to `<project>/CLAUDE.md`.
Claude Code's session init then reads the freshly rendered CLAUDE.md
into the system prompt as usual.

Why a separate source file (rather than rendering CLAUDE.md in place):
the render would overwrite its own source on every session. Keeping the
`.mai` source separate preserves it and makes the relationship clear.

### Directive compatibility matrix

CLAUDE.md is a one-shot system-prompt augmentation. Directives used in
the source MUST follow three rules:

1. **Instantly resolvable** - no network, no shell, no test runners.
2. **Synchronous** - no async, no callbacks, no waiting.
3. **Read-only** - no filesystem writes (CLAUDE.md is for surfacing
   project state, not changing it).

#### Allowed (instant + synchronous + read-only)

| Directive | Notes |
|---|---|
| `@date` | current date / timestamp |
| `@count` | file or line count |
| `@list` | directory listing |
| `@read` | file contents or specific JSON/YAML/CSV value |
| `@read-frontmatter` | single YAML field from a doc |
| `@hash` | content hash |
| `@tree` | directory tree |
| `@if` / `@elseif` / `@else` / `@endif` | conditional branching |
| `@foreach` | iteration over a list source |
| `@set` | bind a value to a variable |
| `@env` | env var read (through the security gate) |
| `@call` | invoke a macro (the macro body must also follow these rules) |
| `@import` | load macros from another file |
| `@include` | inline another file's content |
| `@define` / `@define-concept` / `@constraint` | compile-time / no runtime side effect |
| `@note` / `@prompt` / `@section` / `@chunk-boundary` | content structure |
| `{{ ... }}` interpolation | resolves variables/labels set above |

#### Refused (the hook will not render and explains why)

| Directive | Reason refused |
|---|---|
| `@phase` | lazy-load construct; CLAUDE.md is one-shot, not phased - use mode files served via MCP for phase-by-phase work |
| `@on` | on-complete transition - only meaningful inside `@phase` |
| `@test` | runs the project test suite - too slow for session init |
| `@check` | runs typecheck/lint - too slow for session init |
| `@http` | network call - async and can hang |
| `@query` | arbitrary shell - can be slow or block |
| `@db` | database query - async and can hang |
| `@mkdir` | filesystem write |
| `@copy` | filesystem write |
| `@append-if-missing` | filesystem write |
| `@update-frontmatter` | filesystem write |
| `@render-template` | filesystem write |

If `CLAUDE.md.mai` contains any refused directive, the hook leaves the
existing `CLAUDE.md` untouched, prints a clear message to stderr listing
each refused directive with the category description, and exits 0. The
session always starts; the render is the only thing that's skipped.

### The hook flow

```
Claude Code starts a session
    |
    v
SessionStart hooks fire (in order)
    |
    v
mai SessionStart hook:
  - look for <cwd>/CLAUDE.md.mai
  - if missing, exit 0 silently
  - read source, scan for refused directives
  - if refused: print message to stderr, exit 0 (skip render)
  - else: spawn `mai render <cwd>/CLAUDE.md.mai`, capture stdout
  - on render error: print stderr, exit 0 (skip render)
  - on success: write stdout to <cwd>/CLAUDE.md
    |
    v
Claude Code reads CLAUDE.md into the system prompt
    |
    v
Session continues
```

The hook never exits non-zero. Session init is never blocked by a
broken `.mai` source or render failure - the existing CLAUDE.md is
preserved and the session starts.

### Implementation

- `SESSION_START_HOOK_SCRIPT` const in `init.ts` holds the hook source
  (mjs, with top-level await). Embedded refused-directive table is
  inlined via JSON.stringify of `CLAUDE_MD_REFUSED_DIRECTIVES`.
- `runInit()` now installs both hooks. New
  `ensureSessionStartHookFile()` writes the script; `updateClientHooks()`
  was extended to register a `SessionStart` entry in `settings.json`
  alongside the existing `PreToolUse` entry. Both registrations are
  idempotent (matched by the substring `preToolUse` or `sessionStart`).
- Exported helpers: `findRefusedClaudeMdDirectives(source)` (pure
  function for unit tests) and `buildSessionStartRefusalMessage(refused)`
  (constructs the stderr text).

### Tests (24 new in `init-session-start-hook.test.ts`)

- 7 tests on `findRefusedClaudeMdDirectives` (line-start detection,
  multiple directives, write directives, allowed-set passthrough,
  mid-line prose mention ignored, inside backticks ignored, empty doc).
- 4 tests on `CLAUDE_MD_REFUSED_DIRECTIVES` table completeness (every
  phase/transition, every slow/async runner, every write directive
  listed; no allowed directive in the refused table).
- 4 tests on `buildSessionStartRefusalMessage` shape (per-directive
  bullet line, three-rules explanation, allowed-set summary,
  reassurance line).
- 9 spawn integration tests (no source -> silent exit 0; allowed-only
  source renders to CLAUDE.md; @phase refused; @test refused;
  @mkdir refused; multiple refused listed together; fallback cwd;
  never blocks on invalid stdin; render error doesn't block session).

### Files touched

- `packages/core/src/commands/init.ts` - new constants
  (`CLAUDE_MD_ALLOWED_DIRECTIVES`, `CLAUDE_MD_REFUSED_DIRECTIVES`,
  `SESSION_START_HOOK_SCRIPT`); new exported helpers
  (`findRefusedClaudeMdDirectives`, `buildSessionStartRefusalMessage`);
  new `ensureSessionStartHookFile()`; `updateClientHooks()` extended
  to install both hooks idempotently; `runInit()` calls both.
- `packages/core/src/__tests__/init-session-start-hook.test.ts` -
  new: 24 tests.

### Test totals

- parser: 160 (unchanged)
- engine: 658 (unchanged)
- core: 139 (was 115; +24 SessionStart hook tests)
- mcp: 52 (unchanged)
- mdd: 51 (verified green)
- **total: 1060** (was 1036)

### Migration notes

Non-breaking. Existing users (no `CLAUDE.md.mai` source) see no change -
the SessionStart hook detects the absence and silently exits. Users who
want the new behavior create a `CLAUDE.md.mai` source and re-run
`mai init` to install the new hook. The PreToolUse hook from the prior
commit is unaffected.

### Docs to update

- README: add a section on the `CLAUDE.md.mai` convention and the
  directive compatibility matrix.
- User guide: same.
- `markdownai-instructions/` index (in `~/projects/mdd2`): add an
  entry pointing at this section.

---

## 2026-05-23 | breaking + bug-fix | SessionStart/End hooks: CLAUDE.md is the canonical source (in-place backup + restore)

The earlier `CLAUDE.md.mai` design was wrong. Claude Code always reads
`<cwd>/CLAUDE.md` - that's the file the user maintains, and it's the file
Claude reads. Forcing the user to maintain a separate `.mai` source meant
their natural file (`CLAUDE.md` with directives) never got rendered.

### The corrected flow

- `CLAUDE.md` is the **canonical source**. The user puts `@markdownai`
  directives directly in it. They edit one file, the file they already
  know about.
- `CLAUDE.mai` is a **hook-managed backup**, never edited by the user.

**SessionStart hook:**
1. Read `<cwd>/CLAUDE.md`.
2. If it's not a MarkdownAI doc but `CLAUDE.mai` backup exists, a previous
   session ended dirty - restore `CLAUDE.md` from `CLAUDE.mai` first.
3. If it's still not a MarkdownAI doc, exit 0 (plain CLAUDE.md, no-op).
4. Validate refused directives. If any, leave both files alone, print
   refusal message, exit 0.
5. Copy `CLAUDE.md` -> `CLAUDE.mai` (backup the source).
6. Render `CLAUDE.md` via `mai render`, overwrite `CLAUDE.md` with output.
7. Claude Code's session init reads the rendered `CLAUDE.md`.

**SessionEnd hook (companion):**
1. If `CLAUDE.mai` exists, copy it back to `CLAUDE.md` (restore source).
2. The user's next edit sees the source-of-truth version (with directives).

### Why SessionEnd is best-effort, SessionStart is authoritative

Claude Code's `SessionEnd` hook does NOT fire reliably on SIGTERM, SIGHUP,
terminal close, or crash. The pair (SessionStart, SessionEnd) is not
guaranteed. So `SessionStart` owns crash recovery: when CLAUDE.md is in
its rendered form (no `@markdownai` header) but `CLAUDE.mai` exists, the
hook detects the dirty state and restores before re-running the
backup+render cycle. The restore happens exactly once - subsequent
sessions converge on the steady state.

This also handles Claude Code's `source=clear` and `source=compact`
SessionStart events (which fire mid-process, not at terminal start):
CLAUDE.md is currently rendered output from earlier in the same process,
CLAUDE.mai is the backup; crash-recovery branch restores then re-renders
with fresh data. No source-aware branching needed in the hook.

### Why the in-place design

The user's mental model is unchanged: one file (`CLAUDE.md`), edited
normally. Between sessions, opening `CLAUDE.md` shows the source. During
a session, Claude sees the rendered output. `CLAUDE.mai` is invisible to
the workflow - it's the hook's scratch space.

The trade-off: editing `CLAUDE.md` mid-session has no effect (Claude Code
loads it once at session init, and SessionEnd will overwrite mid-session
edits with the backup). This is acceptable because Claude Code's behavior
already makes mid-session CLAUDE.md edits non-functional - it doesn't
re-read the system prompt within a session.

### Refusal stays at the gate

If `CLAUDE.md` contains a refused directive (`@phase`, `@test`, `@http`,
`@mkdir`, `@update-frontmatter`, etc.), the hook **does not back up** and
**does not render**. Both files are left exactly as they are. Claude
Code will load the raw `CLAUDE.md` with directive syntax visible - that's
the user's signal that they wrote something the hook can't accept.
The refusal message lists exactly which tokens, the category, the three
rules (instant, synchronous, read-only), and the allowed-set summary.

### Implementation

- `SESSION_START_HOOK_SCRIPT` rewritten for the new flow. Reads
  `CLAUDE.md`, handles crash recovery, validates refused directives,
  backs up, renders, overwrites.
- `SESSION_END_HOOK_SCRIPT` is a new constant. Restores `CLAUDE.md` from
  `CLAUDE.mai` if the backup exists. Best-effort; no-op otherwise.
- `ensureSessionEndHookFile()` writes the script alongside the existing
  start hook installer.
- `updateClientHooks()` now registers all three hooks (PreToolUse,
  SessionStart, SessionEnd) idempotently in `settings.json`.
- `runInit()` calls all three installers and passes all three hook paths
  to `updateClientHooks()`.

### Tests (35 in `init-session-start-hook.test.ts`, replacing the prior 24)

`findRefusedClaudeMdDirectives` (7) + refused catalogue (4) + refusal
message shape (4) - unchanged. Plus rewritten/new spawn tests:

- `runStart` 13 tests: no CLAUDE.md no-op; plain markdown no-op; render
  with backup; backup refreshes per session (latest source wins);
  @phase/@test/@mkdir refused (each preserves both files); multi-refused
  listing; **crash recovery** (rendered CLAUDE.md + backup -> restore +
  re-render); both-non-MAI no-op; YAML frontmatter then `@markdownai`
  detected; fallback cwd; malformed stdin exits 0.
- `runEnd` 6 tests: no backup no-op; restore from backup; restore when
  rendered file deleted; fallback cwd; malformed stdin exits 0;
  full lifecycle round-trip (start renders, end restores, repeat).

### Hook lifecycle research that drove the design

Claude Code docs (verified via the claude-code-guide agent):

- SessionStart fires with `source` in {`startup`, `resume`, `clear`,
  `compact`}. All four converge on the same hook flow because crash
  recovery handles "CLAUDE.md already rendered, backup exists".
- SessionEnd fires with `reason` in {`clear`, `resume`, `logout`,
  `prompt_input_exit`, `bypass_permissions_disabled`, `other`}.
  NOT guaranteed on SIGKILL, SIGHUP, terminal close, or crash.
- Stop fires per turn (not session boundary) - not used.

### Files touched

- `packages/core/src/commands/init.ts`:
  - `SESSION_START_HOOK_SCRIPT` rewritten (in-place backup + render,
    crash recovery, refusal-preserves-both-files).
  - `SESSION_END_HOOK_SCRIPT` new constant.
  - `ensureSessionEndHookFile()` new.
  - `updateClientHooks()` takes a third hook path; registers SessionEnd
    entry idempotently.
  - `runInit()` installs and registers all three hooks.
  - `buildSessionStartRefusalMessage()` reworded: "CLAUDE.md left
    untouched" instead of the prior "existing CLAUDE.md".
- `packages/core/src/__tests__/init-session-start-hook.test.ts`:
  rewritten end-to-end suite for the new flow (35 tests).

### Test totals

- parser: 160 (unchanged)
- engine: 658 (unchanged)
- renderer: 45 (unchanged)
- mcp: 52 (unchanged)
- core: 150 (was 139; +11 net for end-hook + crash-recovery + lifecycle)
- **total: 1065** (was 1060)

### Migration notes

**Breaking for users who already adopted the prior `CLAUDE.md.mai`
convention.** Two-step migration:

1. Rename `CLAUDE.md.mai` -> `CLAUDE.md` (overwrite the existing
   rendered file - it'll be regenerated on next session).
2. Re-run `mai init` to register the SessionEnd hook in `settings.json`.

Users who haven't adopted the feature yet: no migration. Put directives
in `CLAUDE.md`, run `mai init`, the hook handles the rest.

### Docs to update

- README: replace the `CLAUDE.md.mai` section with the canonical
  `CLAUDE.md` + `.mai` backup design. The directive compatibility
  matrix is unchanged.
- User guide: same.
- `markdownai-instructions/` index (in `~/projects/mdd2`): update the
  CLAUDE.md hook pointer to describe the new flow.
