# @markdownai/engine

Executes a parsed AST. Resolves directives, runs queries, evaluates expressions, applies the security policy, and returns the final rendered string.

[Root README](../../README.md) · [Parser](../parser/README.md) · [Renderer](../renderer/README.md) · [MCP](../mcp/README.md) · [GitHub](https://github.com/TheDecipherist/markdownai)

## Install

```bash
npm install @markdownai/engine @markdownai/parser
```

Node 18+. DB drivers (mongodb, pg, mysql2, mssql, better-sqlite3) load lazily on first `@connect`.

## What changed in v2

- **Synchronous MongoDB reads.** `@db using="..."` actually queries Atlas / self-hosted Mongo through a sync worker. v1 stubbed this and emitted "async execution required".
- **Struct labels.** `@db ... as=row label=feature` captures the row into `ctx.data.feature` as an object. `{{ feature.source_files }}` dot-access works on real arrays and nested objects. Same shape for `@read`, `@render-template` sinks, and anything else that pipes through `as=row` or `as=json`.
- **`@touch`** for idempotent empty-file scaffolding.
- **Interpolation in file ops.** `@touch`, `@update-frontmatter`, `@render-template`, `@check`, and `@test` all expand `{{ }}` in paths, commands, and template parameter values. v1 only honoured it on a subset of attributes.
- **Test runners on the default allowlist.** `npx vitest`, `npx playwright`, `tsc`, `pnpm test*` work in `@check` / `@test` without manual `~/.markdownai/security.json` edits.
- **Cross-call session state.** Values set with `@set` persist across `resolve_phase` calls when a `skill_session_id` is threaded through the MCP boundary. See the [MCP README](../mcp/README.md).
- **Reusable partials with bound data.** `@template <path> data=<expr> [as=<name>] /` inlines another `.md` file at the call site and binds the expression to `{{ data.* }}` (or `{{ <name>.* }}`) inside the partial. Every directive that works in a top-level document works inside the partial. Reads inherit from the caller's scope (`@set`, `@db`, `@connect`, macros); writes stay local, so the same partial can be rendered repeatedly inside `@foreach` without name collisions. The new `executeTemplate` reads files via `checkSourcePath` to satisfy the filesystem-confinement contract used by `@include` / `@import` / `@read`. `@data <name> ... @data-end` composes a single object from any in-scope values using `<key> = <expression>` assignments, dot-notation for nested keys, and `...<expression>` spreads (deep-cloned and deep-merged). Composed objects live in `ctx.data[name]` with a JSON fallback in `ctx.envFiles[name]`. New as of 1.3.0.

## Sandbox builtins

Available inside `@if` conditions and `{{ }}` interpolations:

| Builtin | Returns |
|---|---|
| `now_iso()` | ISO 8601 timestamp |
| `now_ms()` | `Date.now()` |
| `parse_iso_ms(s)` | ms since epoch from an ISO string |
| `uuid_v4()` | random UUID |
| `truncate(s, n)` | string clipped to n chars |
| `to_json(v)` | JSON-stringified value |
| `parse_brief(text)` | YAML-frontmatter-like key/value extraction |
| `read_section(path, heading)` | section body from a markdown file |
| `read_markdown_section(path, heading)` | same, alternative entrypoint |
| `extract_paths(text)` | filesystem paths mentioned in prose |
| `allowed(value, list, opts?)` | returns `value` if in list, else `false` |

## Worked example

```ts
import { parse } from '@markdownai/parser'
import { execute, makeContext } from '@markdownai/engine'

const ast = parse(`@markdownai v2.0

@db
  using="local"
  find="features"
  where='id == "auth"'
  as=row
  label=feature
  visible=false
@db-end

Feature: {{ feature.title }}
Files: {{ feature.source_files.length }}
`)

const result = execute(ast, {
  ctx: makeContext({
    cwd: process.cwd(),
    security: { allowShell: false, allowHttp: false, allowDb: true, jailRoot: null },
  })
})

console.log(result.output)        // rendered markdown
console.log(result.data.feature)  // { title: '...', source_files: [...] }
```

`EngineResult` carries `output`, `errors`, `warnings`, `events`, and `data` (the struct-label bag).

## Security model

Loaded from `~/.markdownai/security.json` via `loadSecurityConfig()`. Defaults are restrictive:

- Shell - off. Allowlist starts with read-only inspection commands plus test runners.
- HTTP - off. Domain allowlist required.
- DB - off. Per-connection allowlist with read-only / collection / keyword restrictions.
- Filesystem - three jails (`source_root`, `data_root`, `write_root`). Write is off by default.

Immutable blocks (cannot be overridden by config): cloud metadata endpoints, pipe-to-shell patterns (`curl ... | bash`), paths that escape the jail. Blocked operations emit `SECURITY_ALERT` warnings.

Full policy reference and per-jail config shapes are in `src/security/`.

## Public API

```ts
import {
  execute, makeContext, resolveEnv,
  loadSecurityConfig, defaultSecurityConfig,
  evalCondition, evalExpression,
  strip,
  cacheKey, readCache, writeCache, clearSessionCache, clearPersistCache, showCacheEntries,
  isBuiltin, runBuiltin,
  loadPlugins, loadPluginsSync, getPlugin, getPluginSync, detectPlugin, clearPluginCache,
} from '@markdownai/engine'

import type {
  EngineContext, EngineOptions, EngineResult,
  SecurityConfig, ShellSecurityConfig, HttpSecurityConfig, DbSecurityConfig,
  FilesystemSecurityConfig, EventSecurityConfig, EventTransportConfig,
  MacroDefinition, MCPContext, EngineEvent, EventMeta, ChosenTransition,
  StripOptions, StripResult, CacheEntry,
  TraceConfig, TraceSpan,
  LoadedPlugin, PluginLoadResult,
} from '@markdownai/engine'
```

## Tracing

Set `MARKDOWNAI_TRACE=stderr|file:<path>|<url>` to emit one JSON-Lines span per directive. Args are masked unconditionally before serialization. Zero overhead when unset.

## License

MIT.
