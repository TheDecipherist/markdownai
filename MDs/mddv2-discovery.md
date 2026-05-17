# mddv2 × MarkdownAI — Discovery Log

Live tracking of MarkdownAI bugs, gaps, and unexpected behaviours discovered while building mddv2.
Each issue here requires a fix in `~/projects/markdownai` before mddv2 can be verified as working.

**Format per issue:**
- **Status:** `open` | `fix-in-progress` | `fixed-needs-verify` | `verified`
- **Severity:** `blocking` (mddv2 cannot proceed) | `degraded` (workaround exists) | `enhancement` (nice to have)
- **Found in:** which mddv2 feature/file triggered it
- **Fix PR:** link to markdownai fix once raised

---

## Open Issues

### ISSUE-002 - `mai render` never loads security.json - shell always disabled

**Status:** open
**Severity:** blocking - every `@query bash -c "..."` in every mddv2 mode file silently fails
**Found in:** commands/mdd-build.md, commands/mdd-shared.md during comparison test run 2026-05-17
**Discovered:** 2026-05-17

**What was attempted:**
```bash
mai security shell enable
mai security shell add "bash -c *"
mai security shell add "git *"
# Then:
cd /tmp/mdd-test-a
mai render ~/projects/mddv2/commands/mdd-build.md
```

**What happened:**
All `@query` directives silently returned empty string. Security config showed `shell.enabled = true`
but queries never executed. When rendering a complex file (`mdd-build.md`) the ERROR line appeared:
```
ERROR: Error: Shell command blocked [not_allowed]: Shell execution disabled
```
For simpler isolated tests (single `@query` in a small file), no error was shown - just empty output.

**Expected behaviour:**
`mai render` should load `~/.markdownai/security.json` and pass the shell config to the engine
context before executing any directives. Shell queries matching the configured `allow_patterns`
should run and populate their labels.

**Root cause:**
`packages/core/src/commands/render.ts` calls `execute(ast, { filePath, ctx: { envFiles, cwd, consumer } })`
with no `security` key. The engine's `context.ts` defaults to:
```ts
security: { allowShell: false, allowHttp: false, allowDb: false, jailRoot: null }
```
`packages/core/src/commands/security.ts` correctly loads `~/.markdownai/security.json` via
`loadSecurityConfig()` but this is only used by the `mai security` subcommands, never by `render`.

**Fix needed in markdownai:**
In `packages/core/src/commands/render.ts`, load and pass security config to execute:
```ts
import { loadSecurityConfig } from '@markdownai/engine'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SECURITY_CONFIG_PATH = join(homedir(), '.markdownai', 'security.json')
const secConfig = loadSecurityConfig(SECURITY_CONFIG_PATH)

const result = execute(ast, {
  filePath: resolved,
  ctx: {
    envFiles,
    cwd: options.cwd ? resolve(options.cwd) : process.cwd(),
    consumer: options.consumer,
    security: {
      allowShell: secConfig.shell.enabled,
      allowHttp: secConfig.http.enabled,
      allowDb: Object.keys(secConfig.db).length > 0,
      jailRoot: null,
      shellConfig: secConfig.shell,
    },
  },
})
```

**Fix PR:** -
**Verified in mddv2:** -

---

### ISSUE-003 - `@query` inside `@define`/`@call` silently returns empty string (no warning)

**Status:** open
**Severity:** blocking - the entire mdd-shared.md macro library depends on `@query` inside `@define` blocks
**Found in:** commands/mdd-shared.md - every `@define` that uses `@query label=`
**Discovered:** 2026-05-17

**What was attempted:**
```markdown
@markdownai
@define get-branch
@query bash -c "echo 'feat/test'" label=branch_name
@end

@call get-branch
Result: "{{ branch_name }}"
```

**What happened:**
```
Result: ""
EXIT: 0
```
No warning, no error. The `@query` inside the `@define` body silently did not execute. The label
`branch_name` was set to empty string. This is consistent whether the shell is blocked (ISSUE-002)
or allowed - the macro context does not propagate query results back to the caller scope.

**Note:** This may be a compound of ISSUE-002 (shell blocked) and a separate scoping issue. Once
ISSUE-002 is fixed, re-test to determine if `@query` inside `@define` propagates label values
correctly to the calling document's context.

**Expected behaviour:**
After `@call get-branch`, `{{ branch_name }}` in the caller document should hold the value
returned by the `@query` inside the macro body.

**Root cause hypothesis:**
Either (a) the engine evaluates `@define` body at definition time rather than at `@call` time,
so the `@query` runs in a context that discards results; or (b) label variables set inside a macro
body are scoped to the macro and not merged back into the calling context. The engine's
context-passing for `@call` expansions needs to be verified.

**Fix needed in markdownai:**
Engine should merge label variables set by `@query` inside a `@call` expansion back into the
calling document's variable context, making them available to `{{ label }}` references after the
`@call` line.

**Fix PR:** -
**Verified in mddv2:** -

---

### ISSUE-004 - `@if` on a `@query`-sourced label generates "@conditional cannot be used as pipe source"

**Status:** open
**Severity:** degraded - causes ERROR output but render continues (exit 0 in simple cases)
**Found in:** commands/mdd-build.md during render - triggered by `@if {{ doc_count }} == "0"`
**Discovered:** 2026-05-17

**What was attempted:**
```bash
mai render ~/projects/mddv2/commands/mdd-build.md 2>&1
```

**What happened:**
```
WARN: Error: "@conditional" cannot be used as a pipe source
WARN: Unresolvable expression: doc_count
WARN: Unresolvable expression: == "0" and "" == "true"
WARN: Unresolvable expression: missing_source_count
WARN: Unresolvable expression: != "0"
ERROR: Error: Shell command blocked [not_allowed]: Shell execution disabled
```

The `@conditional` warning appears to be an internal representation name for `@if` blocks. When
the engine tries to resolve `@if {{ doc_count }} == "0"` and `doc_count` is undefined (because
the `@query` that would populate it failed due to ISSUE-002), the expression evaluator emits
`Unresolvable expression: doc_count`. The subsequent error text `== "0" and "" == "true"` is the
partially-substituted expression after the undefined variable is replaced with `""`.

**Expected behaviour:**
- When a label used in an `@if` expression is undefined or empty, the engine should treat it as
  `""` and evaluate the expression as `"" == "0"` (false), then emit a WARN, not an ERROR.
- The internal node type `@conditional` should not appear in user-facing error messages - use `@if`.
- The expression `== "0" and "" == "true"` in the WARN output is the raw expression string after
  partial substitution, which is confusing. The warning should show the original expression with
  the unresolved variable name highlighted.

**Root cause:**
Compound of ISSUE-002 (labels never populated) and a gap in the expression evaluator: when a
label variable is missing from context, the evaluator substitutes `""` then tries to re-parse the
remaining expression as a new statement (`== "0" and "" == "true"`), which is not valid syntax.

**Fix needed in markdownai:**
Expression evaluator should handle `{{ undefined_label }}` by substituting `""` and continuing
to evaluate the full expression rather than emitting the partial string as a new parse attempt.
Error messages should use `@if` not `@conditional`.

**Fix PR:** -
**Verified in mddv2:** -

---

### ISSUE-005 - `@import` blocks absolute paths with FatalError (not documented in spec)

**Status:** open
**Severity:** degraded - affects usage pattern where mode files live outside the project directory
**Found in:** ad-hoc test during render debugging, 2026-05-17
**Discovered:** 2026-05-17

**What was attempted:**
```markdown
@markdownai
@import /tmp/test-importee.md
```

**What happened:**
```
FatalError: @import blocked: Absolute paths are not permitted
EXIT: 1
```

**Expected behaviour:**
The spec documents `@import ./path.md` with relative paths. Absolute path blocking is
intentional (filesystem jail). However:
1. The error class is `FatalError` which causes exit code 1 and no output - this is too
   aggressive for what is arguably a user error. Should be a validation error with a helpful
   message like "Use a path relative to the document's directory."
2. The restriction is not documented in the `@import` section of the spec. The spec only
   shows relative path examples without stating that absolute paths are forbidden.

**This affects mddv2:** Mode files reference `@import mdd-shared.md` (relative). This works
correctly when the mode files are in the same directory. It would fail if a user tries to render
a mode file from a different directory using an absolute path to `mdd-shared.md`.

**Fix needed in markdownai:**
1. Downgrade `FatalError` to a render error with a clear message suggesting relative paths.
2. Add a note to the spec: "`@import` paths must be relative to the importing document's
   directory. Absolute paths are not permitted."

**Fix PR:** -
**Verified in mddv2:** -

---

### ISSUE-001 — `mai validate` rejects @markdownai after YAML frontmatter

**Status:** verified
**Severity:** blocking — `mdd.md` (the Claude Code skill file) cannot pass `mai validate`
**Found in:** commands/mdd.md during Wave 1 feature: mdd-router
**Discovered:** 2026-05-16

**What was attempted:**
`mai validate commands/mdd.md` on a file with Claude Code YAML frontmatter at top, then `@markdownai` in the body.

**What happened:**
```
ERROR: Not a MarkdownAI document (missing @markdownai header on line 1)
```

**Expected behaviour:**
`mai validate` should recognize YAML frontmatter (delimited by `---`) as transparent metadata and accept `@markdownai` on the first non-frontmatter line.

**Root cause:**
The spec (MDs/markdownai-spec-v1.0.md line 120) states: "placing @markdownai as the very first line." The parser/hook checks only the first ~20 bytes. Claude Code skill files require YAML frontmatter with `description:`, `scope:`, `allowed-tools:` — these cannot move after `@markdownai`.

**The conflict:**
- Claude Code skill format: `---\ndescription: ...\n---\n(body)`
- MarkdownAI activation: `@markdownai` must be line 1
- These two requirements are incompatible for the same file

**Workaround:**
Two options — pick one before proceeding:
1. Fix MarkdownAI parser + hook to recognize YAML frontmatter as transparent (recommended)
2. Accept that `mdd.md` is NOT a MarkdownAI document (Claude reads it as plain text), and only apply `@markdownai` to mode files + templates that Claude reads via the Read tool

**Fix needed in markdownai:**
In the hook (`packages/core/src/hook.ts` or equivalent) and parser (`packages/parser/src/`):`
- If file starts with `---` on line 1, skip to closing `---`, THEN check if first non-empty line is `@markdownai`
- Update spec line 120 to: "placing `@markdownai` as the first line, or as the first line after an optional YAML frontmatter block"

**Fix applied:** `packages/parser/src/parser.ts` — `parse()` now skips YAML frontmatter (`---...---`) and optional blank lines before checking for `@markdownai`. `packages/core/src/hook.ts` — `shouldRoute()` and `isMarkdownAIFile()` updated with `startsWithMarkdownAI()` helper that handles frontmatter. `packages/core/src/commands/validate.ts` — `collectDefines()` now resolves `@import` macros so cross-file `@call` references don't generate false errors. `MDs/markdownai-spec-v1.0.md` updated at lines 120 and 136-147. Six new parser tests added.
**Fix PR:** — (committed on branch mdd/session-20260516-162153)
**Verified in mddv2:** `mai validate commands/mdd.md` → ✓ no errors (2026-05-16)

---

## Resolved Issues

- ISSUE-001: `mai validate` rejects `@markdownai` after YAML frontmatter - verified fixed 2026-05-16

---

## Issue Template

```
### ISSUE-NNN — <short title>

**Status:** open
**Severity:** blocking | degraded | enhancement
**Found in:** commands/mdd-shared.md during Wave 1 feature: mdd-shared-library
**Discovered:** YYYY-MM-DD

**What was attempted:**
<what directive / syntax was used>

**What happened:**
<exact error or unexpected output>

**Expected behaviour:**
<what the spec says should happen>

**Root cause hypothesis:**
<MarkdownAI parser/engine/renderer gap or bug>

**Workaround (if any):**
<interim approach used in mddv2 until fixed>

**Fix needed in markdownai:**
<specific file and change>

**Fix PR:** —
**Verified in mddv2:** —
```

---

## How This Works

1. During mddv2 development, when a `@markdownai` directive fails or behaves unexpectedly, add an entry here
2. File a GitHub issue on `~/projects/markdownai` (or fix directly)
3. Once fixed and `mdd update` is run to sync markdownai changes, mark the issue `fixed-needs-verify`
4. Re-run the affected mddv2 test — if it passes, mark `verified`
5. mddv2 is only considered complete when this log has zero `open` or `fixed-needs-verify` entries
