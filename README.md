<p align="center">
  <img src="docs/markdownAI_hero.webp" alt="MarkdownAI - Documentation That Cannot Lie" width="100%" />
</p>

# MarkdownAI

> **documentation that cannot lie.**

[![npm version](https://img.shields.io/badge/version-2.0.0-0891b2)](https://www.npmjs.com/package/@markdownai/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

---

## What is MarkdownAI

A Markdown superset for AI-assisted workflows. Documents mix prose with executable directives - data sources, control flow, file ops, test runs, DB queries - and the engine renders directives at read time so docs stay synced with the underlying project. Originally built for the MDD (Manual-Driven Development) workflow, but the grammar and runtime are generic enough for any agentic-coding pipeline.

---

## The directive grammar in one snapshot

```
# 1. Self-closing (atomic, no body, no continuation)
@import ~/path/to/macros.md /
@touch path="src/foo.ts" /
@on-complete next-phase /

# 2. Block with attributes (no body)
@db
  using="mdd"
  find="features"
  where='id == "X"'
  label=feature
@db-end

# 3. Block with attributes + body
@phase 0_branch_check
  required=true
>
  @call branch-guard /
  @on-complete 0_5_repo_version_check /
@phase-end
```

Familiar to anyone who's written HTML / JSX / Vue / Svelte / Astro - `@` instead of `<` so directives don't conflict with embedded HTML in markdown.

---

## What's new in v2

### Unified directive grammar

Every directive uses the three forms above. The v1 split between "block" directives (closed with bare `@end`) and "inline" directives (single-line only, silently dropped continuations) is gone. The close tag carries the directive name, so nested blocks read clearly:

```
@phase X
  @if {{ ready }}
    @foreach f in {{ files }}
      - {{ f }}
    @foreach-end
  @if-end
@phase-end
```

Bare `@end`, `@endif`, `@endswitch`, and `@on complete -> X` are no longer accepted. The migration tool rewrites existing v1 files mechanically.

### Synchronous MongoDB queries

`@db using="..."` actually hits Atlas or self-hosted Mongo now. In v1 the directive was stubbed and emitted an "async execution required" warning. v2 runs read-only queries through a sync worker so the result is available in the same render pass.

### Struct labels

`@db ... as=row label=feature` captures the row into `ctx.data[label]`, so `{{ feature.source_files }}` dot-access works on real arrays and nested objects. Same shape works for `@read` and any directive that materializes data.

### New sandbox builtins

`parse_brief`, `read_section`, `extract_paths`, `now_iso`, `to_json`, `truncate`, `parse_iso_ms`, `uuid_v4`, `allowed`. Available inside `@if` conditions and `{{ }}` interpolations alike.

### Cross-call closure for skill flows

A `skill_session_id` keys per-(session x document) state inside the MCP server. `@set` values persist across `resolve_phase` calls in multi-phase flows, so a skill can collect values in phase 1 and read them back in phase 5 without round-tripping through the host.

### Plugin loader and `@markdownai-detect`

Framework descriptors (`mdd.plugin.md`, others) declare project layout at render time. Documents pull layout facts from the descriptor instead of guessing - no more layout-inference hallucinations when the AI hasn't seen the project before.

### Reusable partials with bound data

`@template ./row.md data=<expression> /` inlines another MarkdownAI document at the call site and binds it to a data context, like a partial in Angular or Vue. `@data <name> ... @data-end` composes a single object from any in-scope values (db results, set variables, env fallbacks) using `<key> = <expression>` assignments, dot-notation for nested keys, and `...<expression>` spreads. Inside the partial, the bound value is accessible as `{{ data.* }}` (or `{{ <name>.* }}` via `as=<name>`). Reads inherit from the caller's scope; writes stay local, so the same partial can be called repeatedly inside `@foreach` without name collisions.

### `@touch` directive

Idempotent empty-file creation for scaffolding. Safe to re-run.

### Interpolation in file ops

`@touch`, `@update-frontmatter`, `@render-template`, `@check`, and `@test` all expand `{{ }}` correctly in paths, commands, and arguments. v1 only honoured interpolation in a subset of attributes.

### Test runners on the default allowlist

`npx vitest`, `npx playwright`, `pnpm test`, `tsc`, and other common test commands work in `@check` and `@test` blocks without manual `~/.markdownai/security.json` edits.

---

## Package layout

| Package | What it does | Path |
|---|---|---|
| `@markdownai/parser` | directive grammar + AST | [packages/parser](packages/parser/README.md) |
| `@markdownai/engine` | executes directives, renders documents | [packages/engine](packages/engine/README.md) |
| `@markdownai/renderer` | source-output formatters (table/list/row/json/...) | [packages/renderer](packages/renderer/README.md) |
| `@markdownai/mcp` | Model Context Protocol server (11 tools) | [packages/mcp](packages/mcp/README.md) |
| `@markdownai/core` | `mai` CLI | [packages/core](packages/core/README.md) |

A VS Code extension (`markdownai` on the marketplace) provides syntax highlighting, snippets, and diagnostics for `.md` files that start with `@markdownai`.

---

## Quickstart

Install the CLI globally:

```bash
npm install -g @markdownai/core
```

Create a small doc - `hello.md`:

```
@markdownai v2.0

# Project status

Database has @count using="local" find="users" / users right now.

@if {{ env.NODE_ENV == "production" }}
  Running in production mode.
@if-end
```

Render it:

```bash
mai render hello.md
```

The same file renders through the MCP server when AI assistants use the `mcp__markdownai__render` tool - the document arrives with directives already resolved, no extra round-trips needed.

---

## Migration from v1

v2 is a breaking syntax change. Pin to `^2.0.0` (v1 stays on `^1.x` and keeps working). Run the migration tool once over each v1 file:

```bash
node ~/projects/markdownai/packages/parser/scripts/migrate-v1-to-v2.mjs <file> --in-place
```

The script is idempotent - re-running on a v2 file is a no-op. Full grammar spec is in [`MDs/markdownai-spec-v2.0.md`](MDs/markdownai-spec-v2.0.md).

---

## Security model

The engine enforces shell, HTTP, DB, and filesystem allowlists at `~/.markdownai/security.json`. Defaults are restrictive: shell starts with read-only commands plus common test runners; HTTP is off; DB is off. Users opt in to broader access by editing the config. See the engine README for the full policy.

---

## Status

v2.0.0. Currently in use for MDD v2.

## License

MIT.
