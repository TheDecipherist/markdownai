---
id: 96-plugin-data-directive
title: Plugin Data Directive (@plugin-data)
edition: MarkdownAI
depends_on: ["94-plugin-loader"]
relates: ["94-plugin-loader", "95-plugin-detect-directive"]
source_files:
  - packages/parser/src/directives/plugin-data.ts
  - packages/parser/src/types.ts
  - packages/engine/src/plugin-detect-exec.ts
  - packages/engine/src/index.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/plugin-data.test.ts
  - packages/engine/src/__tests__/plugin-data-directive.test.ts
data_flow: reads-existing
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [plugin-system, directives, plugin-data, engine, parser]
path: Engine/Plugins
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
initiative: markdownai-plugin-system
wave: markdownai-plugin-system-wave-2
wave_status: active
---

# 96 - Plugin Data Directive (@plugin-data)

## Purpose

Returns the full descriptor of a named installed plugin. Lets a document ask "what does the mdd plugin say about itself?" and embed the answer inline. Primarily useful for documentation, onboarding docs, and plugin-aware renderers.

## Architecture

Two layers:

1. **Parser** (`plugin-data.ts`) - parses `@plugin-data name="<slug>"` into a `PluginDataNode`.
2. **Engine executor** (`plugin-detect-exec.ts`) - shared module with feature 95. Handles `PluginDataNode` by calling `loadPluginsSync`, finding the named plugin, and formatting its descriptor.

```
@plugin-data name="mdd" [include=<sections>] [project=<path>]
  |
  +-- parser: parse args -> PluginDataNode
  |
  +-- engine: loadPluginsSync(projectRoot) -> getPluginSync(name, plugins)
  |
  +-- format full descriptor
```

## AST Node

New node type added to `packages/parser/src/types.ts`:

```typescript
export interface PluginDataNode extends ASTNodeBase {
  type: 'plugin-data'
  name: string            // required plugin name
  include: string[]       // sections to include: 'layout', 'conventions', 'meta', 'detect', 'all'
  label: string | null    // from label= arg
  projectOverride: string | null
}
```

## Arguments

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name=` | string | yes | Plugin name (slug matching `plugin_name` frontmatter) |
| `include=` | comma-separated | no | Sections: `layout`, `conventions`, `meta`, `detect`, `all` (default: `meta` only) |
| `label=` | string | no | Store output in context variable |
| `project=` | path | no | Override project root for plugin search |

If `name=` is missing, a `ParseError` is thrown at parse time.

## Output

Default (`include=` not set):

```
mdd (v1.0.0) — MDD Manual-Driven Development
Homepage: https://github.com/TheDecipherist/mdd
Framework: mdd / v1.0.0 / marker: mdd-v1
```

With `include=layout`:

```
mdd (v1.0.0) — MDD Manual-Driven Development
Homepage: https://github.com/TheDecipherist/mdd
Framework: mdd / v1.0.0 / marker: mdd-v1

Layout:
  .mdd/                 - MDD root
  .mdd/docs/            - Feature documentation
  .mdd/waves/           - Wave planning docs
```

If the plugin is not found:

```
[plugin-data: plugin "mdd" not found]
```

This is a non-fatal output — the directive does not throw when a plugin is missing, it emits the not-found string into the output and adds a warning to `ctx.warnings`.

## Business Rules

- `name=` argument is required; missing name is a ParseError (caught at parse time)
- Plugin not found: emit `[plugin-data: plugin "<name>" not found]` string, push warning, do not throw
- `include=all` renders: meta, detect rules, layout, conventions (each section only if present)
- `label=` stores result in `ctx.envFiles` before returning (same value as the output)
- `project=` follows same rules as in feature 95

## Data Flow

Reads from the plugin loader (filesystem). `loadPluginsSync` is the shared sync variant added in feature 95.

## Dependencies

- `94-plugin-loader` — `LoadedPlugin` types and plugin search path logic
- `95-plugin-detect-directive` — shares `plugin-detect-exec.ts` which contains `loadPluginsSync` and formatting utilities

## Security

`project=` override follows same constraints as feature 95. No user-controlled paths are used in file reads — the plugin search paths are fixed by `loadPluginsSync`.

## Known Issues

(none)
