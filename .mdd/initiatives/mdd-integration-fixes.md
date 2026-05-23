---
id: mdd-integration-fixes
title: MDD Integration Fixes
status: active
version: 1
hash: f35efc76
created: 2026-05-23
---

# MDD Integration Fixes

## Overview

Address issues discovered while integrating MarkdownAI into MDD (`~/projects/mdd2`). MDD
shared-library macros currently route project-file access through `@query bash -c "..."`
because MarkdownAI jails `file.*`, `@list`, `@read`, `@tree` to the document directory.
That conflates two different path-resolution contexts: source loading (`@import`/`@include`)
and data operations (`@list`/`@read`/`file.*`). Splitting them lets shared libraries operate
on the caller's cwd while keeping source paths portable.

Also fixes several smaller issues that surfaced during integration: `||` parser bug,
`@query` interpolation missing, no CLI way to set skill context, absolute paths in
`@import` rejected without configurable exceptions.

Adds three write directives (`@copy`, `@mkdir`, `@append-if-missing`) so frequently-used
bootstrap patterns stop needing shell wrappers.

Target: **v2.0.0** (breaking changes documented in `~/projects/markdownai/changed.md`).

## Open Product Questions

- [x] Source vs data root split: how is it configured? Via `security.json` filesystem
  section with `source_root` and `data_root` keys.
- [x] Default `data_root`? `cwd` (process working directory).
- [x] Default `source_root`? `auto` = `dirname(file)` of the entry document.
- [x] How are skill libraries reached for absolute imports? Configurable patterns in
  `filesystem.allowed_source_paths`; supports `${CLAUDE_SKILL_DIR}` expansion.
- [x] Write directives default state? Disabled (`filesystem.write_enabled: false`); opt-in.
- [x] Immutable write denies? `.env`, `.env.*`, `credentials*`, `*.pem`, `.ssh/**`, `.git/**`.
- [x] `@query` interpolation: does it interpolate? Yes, with auto shell-escape (single-quote
  wrap, internal quotes escaped). Backward incompatible for any doc relying on literal
  `{{ X }}` passing through to shell - we accept this in v2.0.
- [x] `||` parser fix: API impact? None. Pure bug fix.
- [x] `--skill-args` API: flags? `--skill-args "raw string"`, `--skill-dir <path>`,
  `--skill-session-id <id>`, `--skill-effort <level>`.

## Principle: when to add a new directive

If `@query` is reached for the same operation 3+ times across the codebase, that operation
is a candidate for a native directive. Today's threshold-passers (from MDD's shared library):
- `mkdir -p ...` (1× now; common in bootstrap) → `@mkdir`
- `[ -f x ] || cp ...` (3×) → `@copy if-missing`
- `grep ... || printf ... >> ...` (1× now; common pattern) → `@append-if-missing`

`@query` then drops back to its proper role: external tools (git, npm, custom user scripts),
not file operations MarkdownAI could do natively.

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/mdd-integration-fixes-wave-1.md | Source vs data root split: `@list`/`@read`/`file.*` resolve relative to `cwd` by default; `@import`/`@include` resolve relative to document; security config supports both. MDD shared library macros work natively (without `@query` workarounds) against this engine. | planned |
| Wave 2 | waves/mdd-integration-fixes-wave-2.md | `\|\|` parser fix + `--skill-args` CLI flag + `@query` interpolation with shell-escape + absolute-path imports via `allowed_source_paths`. MDD tests pass using these features. | planned |
| Wave 3 | waves/mdd-integration-fixes-wave-3.md | `@mkdir`, `@copy`, `@append-if-missing` directives implemented with security gates. MDD shared library rewritten to use them. MDD test suite stays green. | planned |
| Wave 4 | waves/mdd-integration-fixes-wave-4.md | v2.0.0 release: changed.md finalized, README updated, user guide updated, website docs updated. MDD updates to depend on `@markdownai/core@^2.0.0`. | planned |
