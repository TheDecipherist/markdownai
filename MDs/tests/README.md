@markdownai v1.0

# MarkdownAI Directive Verification Suite

@constraint[critical] Every directive must render correctly - raw directive syntax must never appear in output
@constraint[high] All @prompt blocks must be read and acted on during verification

@prompt
You are about to verify that every MarkdownAI directive works correctly end-to-end.

Read each test file via the MCP read_file tool (not the plain Read tool) so that
directives are rendered. For phase-based tests, use list_phases, resolve_phase,
and next_phase MCP tools directly.

Work through each file below in order. After reading each file, report:
- Which directives were tested
- Whether each one produced the expected output (PASS or FAIL)
- Any raw directive syntax that appeared in the output (that is always a bug)

IMPORTANT: Read test files relative to the project root. Pass paths like:
  "MDs/tests/test-basics.md"
to the read_file tool.
@end

---

## Test Files

| File | Directives Covered |
|---|---|
| test-basics.md | @env, {{ env.VAR }}, @date, {{ date }}, @define, @call, @if, @constraint, @note, @define-concept, @section |
| test-include-import.md | @include, @import |
| test-phases.md | @phase, @on complete, list_phases tool, resolve_phase tool, next_phase tool |
| test-phase-isolation.md | Phase isolation: sentinel strings must never bleed across phase boundaries |
| test-phase-amnesia.md | Phase information compartmentalization: passphrases from Phase A must be invisible from Phase B |
| test-phase-realistic.md | Realistic 6-phase workflow: measures actual token savings per phase |
| test-rendering.md | @list, @tree, @count, @read, mai-graph, @chunk-boundary, pipe chains |
| test-http.md | @http syntax, security blocking (cloud metadata), behavior with allowHttp=false |

---

## Quick Verification Checklist

After reading all test files, confirm:

- [ ] @env standalone outputs real env var values (USER, HOME, SHELL)
- [ ] {{ env.VAR }} inline resolves in text, supports ?? fallback
- [ ] @date outputs ISO datetime; {{ date format="YYYY-MM-DD" }} formats correctly
- [ ] @define / @call produces correct macro output with parameter substitution
- [ ] @if with env var names (not {{ }}) conditionally renders content
- [ ] @if false never renders; @if true always renders
- [ ] @constraint lines parse without error
- [ ] @note without "visible" keyword suppresses body; @note visible shows body as blockquote
- [ ] @define-concept is single-line (not a block); multi-word definition must be quoted
- [ ] @section separates content correctly
- [ ] @include inlines rendered content from another file
- [ ] @import brings in macro definitions without rendering them
- [ ] @phase blocks are navigable via MCP tools
- [ ] list_phases returns ["setup", "main", "review"] for test-phases.md
- [ ] next_phase("setup") returns "main"; next_phase("review") returns null
- [ ] ISOLATION: resolve_phase("alpha") contains ALPHA-SENTINEL and NO other sentinels
- [ ] ISOLATION: resolve_phase("beta") contains BETA-SENTINEL and NO other sentinels
- [ ] AMNESIA: resolve_phase("blue") contains AZURE passphrase, NOT CRIMSON or EMERALD
- [ ] AMNESIA: resolve_phase("red") contains CRIMSON passphrase, NOT AZURE or EMERALD
- [ ] REALISTIC: 6 phases in test-phase-realistic.md; each resolves to ~20% of full file size
- [ ] @list outputs file listing; supports match= and depth= args
- [ ] pipe chains work: @list . | sort | head -n 3
- [ ] @tree renders ASCII directory tree; depth= limits depth
- [ ] @count returns line count for a file
- [ ] @read outputs raw file content (not rendered)
- [ ] mai-graph code fence renders graph content without error
- [ ] @chunk-boundary splits content (renders as HTML comments in standard format)
- [ ] @http is silently stripped when allowHttp=false (default CLI behavior)
- [ ] @http cloud metadata endpoints are ALWAYS blocked (never produce output)

---

## How to Run Verification

```
# Via MCP (preferred - directives are rendered by server):
Use the read_file MCP tool with the file path relative to project root.
Example: read_file({ path: "MDs/tests/test-basics.md" })

# Phase tools:
list_phases({ file: "MDs/tests/test-phases.md" })
resolve_phase({ file: "MDs/tests/test-phases.md", phase: "setup" })
next_phase({ file: "MDs/tests/test-phases.md", current_phase: "setup" })

# Phase isolation test (sentinels):
resolve_phase({ file: "MDs/tests/test-phase-isolation.md", phase: "alpha" })
resolve_phase({ file: "MDs/tests/test-phase-isolation.md", phase: "beta" })

# Phase amnesia test (passphrases):
resolve_phase({ file: "MDs/tests/test-phase-amnesia.md", phase: "red" })
resolve_phase({ file: "MDs/tests/test-phase-amnesia.md", phase: "blue" })

# Realistic workflow - measure sizes:
list_phases({ file: "MDs/tests/test-phase-realistic.md" })
resolve_phase({ file: "MDs/tests/test-phase-realistic.md", phase: "testing" })

# Via CLI (also valid - some directives behave differently):
mai render MDs/tests/test-basics.md
mai render MDs/tests/test-include-import.md
cd MDs/tests && mai render test-rendering.md   # must run from tests/ dir
mai render MDs/tests/test-phases.md
mai render MDs/tests/test-http.md
```
