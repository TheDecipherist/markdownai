---
id: mdd-integration-fixes-wave-2
title: "Wave 2: Parser, CLI Flags, Query Interpolation, Absolute Imports"
initiative: mdd-integration-fixes
initiative_version: 1
status: in_progress
depends_on: mdd-integration-fixes-wave-1
demo_state: "@if conditions accept || operator. mai render --skill-args 'foo' populates ARGUMENTS for local skill testing. @query bash -c '... {{ VAR }} ...' interpolates with auto shell-escape. @import accepts absolute paths matching allowed_source_paths."
created: 2026-05-23
hash: 2c1887d9
---

# Wave 2: Parser, CLI Flags, Query Interpolation, Absolute Imports

## Demo-State

- `@if env.X == "a" || env.X == "b"` no longer fails with `cannot be used as a pipe source`.
- `mai render mdd.md --skill-args "audit foo"` populates `ARGUMENTS` for local skill testing
  (same as MCP's `read_file` with `skill_args`).
- `@query bash -c "cp '{{ CLAUDE_SKILL_DIR }}/x.md' ./y.md"` interpolates the variable with
  shell-quoting applied. Quotes/backticks in interpolated values cannot break out of the
  enclosing quotes (injection-safe).
- `@import /absolute/path.md` succeeds when path matches `filesystem.allowed_source_paths`.

*(This wave is not complete until this can be manually demonstrated, MDD tests stay green,
and security tests cover the shell-escape boundary.)*

## Scope

### 1. `||` parser fix (item #7 in markdownai-comments.md)

The parser line-classifier treats `|` as a pipe operator and tries to parse `@if A || B`
as `@if A | (rest)`, producing `"@conditional" cannot be used as a pipe source`.

Fix: pipe detection skips lines whose leading directive is `@if`, `@elseif`, `@else`,
`@endif`. Inside those lines, `||` and `&&` are boolean operators in JS expression syntax.

No API surface change. Pure bug fix. Add tests covering:
- `@if A || B`
- `@if A || B || C`
- `@if A && B || C`
- `@if (A || B) && C`
- `@elseif A || B`
- Existing `||` inside `{{ expr }}` interpolation still works
- Existing pipes elsewhere (`@list X | sort | @render`) still work

### 2. `--skill-args` and related CLI flags (item #4)

Add to `mai render`:

```
--skill-args "<raw arg string>"   sets skill context $ARGUMENTS / argsList / arg0..arg3
--skill-dir <path>                sets $CLAUDE_SKILL_DIR
--skill-session-id <id>           sets $CLAUDE_SESSION_ID
--skill-effort <level>            sets $CLAUDE_EFFORT (low|medium|high|xhigh|max)
```

These exactly mirror the MCP `read_file` skill_* parameters. Trust model is identical
(CLI users already have full filesystem access on their machine, so no escalation risk).

Build `skillContext` from these flags and pass to `execute()`. Same `buildSkillContext`
helper that `mcp/tools/read_file.ts` uses — extract to a shared spot if it isn't already.

Tests in `packages/core/src/__tests__/render-skill-args.test.ts`.

### 3. `@query` `{{ }}` interpolation with shell-escape (item #1)

Today `@query bash -c "cp '{{ X }}/foo' .mdd/bar"` passes the literal `{{ X }}` to the
shell. After Wave 2, MarkdownAI interpolates `{{ X }}` at render time, BUT every
interpolated value is shell-escaped before being substituted into the command string.

**Shell-escape algorithm**: wrap each value in single quotes; replace each internal
single quote with `'\''` (close-quote, escaped quote, reopen-quote). This is the
canonical POSIX-safe escape. Result has no shell-metacharacter exposure even if the
value contains backticks, `$()`, `;`, `&`, `|`, etc.

**Important security caveat**: a single-quoted shell argument is safe from injection.
A double-quoted argument is NOT (`$(...)` still evaluates). So if a user writes:

```
@query bash -c "echo \"hello {{ NAME }}\""
```

…and NAME contains `$(rm -rf /)`, our shell-escape only works if we replace inside
single-quoted segments. We CANNOT shell-escape double-quoted contexts safely without
parsing the shell. So:

- If the `{{ X }}` appears inside a single-quoted segment of the command, replace with
  the safe `'value'` form, breaking the surrounding quotes correctly.
- If it appears inside a double-quoted segment or unquoted, we warn loudly and refuse
  to interpolate (output the literal `{{ X }}` and add a SECURITY_ALERT warning).
- If it appears at start of a token (no preceding quote), warn and refuse.

This requires a small shell-aware tokenizer that walks the command string and tracks
quote state. Not a full parser — just enough to know "am I inside `'...'` right now?"

**MDD impact**: MDD currently writes `@query bash -c "cp \"$CLAUDE_SKILL_DIR/...\""`
using shell variable expansion. With Wave 2, MDD CAN switch to `'{{ CLAUDE_SKILL_DIR }}/'`
syntax which is safer and more declarative. But it doesn't HAVE to — the shell-var form
still works.

Tests in `packages/engine/src/__tests__/query-interpolation.test.ts`:
- Safe interpolation inside `'...'`
- Refuse-with-warning inside `"..."`
- Refuse-with-warning outside quotes
- Injection attempt with `$(rm -rf /)` in single-quoted context cannot escape
- Multiple `{{ }}` substitutions in one command
- Empty value handling

### 4. Absolute paths in `@import` via `allowed_source_paths` (item #9)

Wave 1 infrastructure already supports this — `checkSourcePath` matches absolute paths
against the allowlist. Wave 2 work is verification: write integration tests covering:

- `@import /tmp/whitelisted/lib.md` succeeds when `allowed_source_paths` includes `/tmp/whitelisted/**`
- Same absolute path blocked when allowlist doesn't include it
- `${CLAUDE_SKILL_DIR}/lib.md` expands and matches `${CLAUDE_SKILL_DIR}/**`
- Path traversal blocked even when allowlist is broad
- `.env` files blocked even when allowlist is broad (immutable rules)

### 5. MDD cleanup

After Wave 2:

- `tests/helpers.ts` uses `--skill-args` flag instead of writing env file
- `mdd.md` uses plain `ARGUMENTS` instead of `(env.ARGUMENTS ?? ARGUMENTS)` fallback
- Dispatch `@elseif` chains collapse back to grouped `||` conditions (much shorter)

This is the cleanup pass — proves the Wave 2 fixes work end-to-end.

## Security Analysis (focused on item 3)

`@query` interpolation is the only Wave 2 item with non-trivial security implications.

**Threat**: an interpolated value reaches the shell unescaped, allowing the
value to inject arbitrary commands.

**Sources of interpolated values**:
- Process env vars (always trusted on the user's machine)
- Skill args (from MCP — trusted same as user; from CLI — typed by user)
- Stdlib macro results (e.g. `git branch --show-current` — already shell output)
- @query label= results (already shell output)

**Mitigations**:
1. Shell-aware tokenizer identifies safe substitution contexts (single-quoted only).
2. Unsafe contexts (double-quoted, unquoted) refuse interpolation with a SECURITY_ALERT.
3. Single-quote escape is canonical POSIX; cannot be subverted.
4. Existing `bash -c` allowlist in shell config still applies — broad commands are
   already opt-in.

**What we do NOT change**:
- The shell allow-list still gates `@query` itself.
- The audit log still captures the executed command.
- Immutable shell-block patterns (`rm -rf /`, `curl | bash`, etc.) still apply.

The shell-aware tokenizer is a new attack surface. Tests must cover edge cases:
nested quotes, escape sequences inside double quotes (`\$`), `$'...'` POSIX C-quoted
strings, here-docs (`<<EOF`), and process substitution `<(...)`.

For Wave 2 simplicity: a "conservative parser" that only allows `{{ X }}` inside
plain single-quoted strings. Anything fancier (here-docs, `$'...'`) refuses
interpolation. This is restrictive but safe; users can opt into shell variable
expansion (`"$X"`) when they want a less-restricted pattern.

## Open Research

- Should the conservative parser issue an error or a warning when refusing to
  interpolate? Currently warning + literal pass-through. An error might be safer but
  breaks more documents.
- Should we also support `{{ X }}` inside heredoc bodies? They are commonly used in
  `@query cat > file <<EOF ... EOF` patterns in MDD bootstrap. Decide based on MDD
  usage — if MDD wants this, add a more permissive heredoc-aware mode.

## Implementation order

1. Parser fix (item 1) — quickest, no API change, builds confidence
2. CLI flags (item 2) — additive, no API change
3. Absolute @import verification (item 4) — mostly tests
4. @query interpolation (item 3) — most design work
5. MDD cleanup (item 5) — integration check
