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

- ISSUE-001: moved to verified (see above)

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
