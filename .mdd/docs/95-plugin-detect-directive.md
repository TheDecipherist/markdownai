---
id: 95-plugin-detect-directive
title: Plugin Detect Directive (@markdownai-detect)
edition: MarkdownAI
depends_on: ["94-plugin-loader"]
relates: ["94-plugin-loader", "96-plugin-data-directive", "97-available-directives-tool"]
source_files:
  - packages/parser/src/directives/markdownai-detect.ts
  - packages/parser/src/types.ts
  - packages/engine/src/plugin-detect-exec.ts
  - packages/engine/src/plugin-loader.ts
  - packages/engine/src/index.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/markdownai-detect.test.ts
  - packages/engine/src/__tests__/plugin-detect-directive.test.ts
data_flow: reads-existing
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [plugin-system, directives, detection, engine, parser]
path: Engine/Plugins
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/plugin-detect-exec.ts (project root filesystem reads)
known_issues: []
initiative: markdownai-plugin-system
wave: markdownai-plugin-system-wave-2
wave_status: active
---

# 95 - Plugin Detect Directive (@markdownai-detect)

## Purpose

A consumer-facing engine directive that scans for installed plugins and runs each plugin's detection rules against the current project root. Returns a formatted summary of matching plugins. This is how a MarkdownAI document can assert which frameworks are active in the current project — without hardcoded detection logic.

## Architecture

Three layers:

1. **Parser** (`markdownai-detect.ts`) - parses `@markdownai-detect` args into a `MarkdownaiDetectNode` (non-block directive).
2. **Sync loader extension** (`plugin-loader.ts`) - adds `loadPluginsSync()` and `detectPlugin()` so the synchronous engine can call them without await.
3. **Engine executor** (`plugin-detect-exec.ts`) - handles `MarkdownaiDetectNode`, calls sync loader, runs detection, formats output.

```
@markdownai-detect [as=<format>] [include=<sections>] [project=<path>]
  |
  +-- parser: parse args -> MarkdownaiDetectNode
  |
  +-- engine: loadPluginsSync(projectRoot)
  |     returns LoadedPlugin[]
  |
  +-- for each plugin: detectPlugin(plugin, projectRoot)
  |     file/dir checks first (fast signals)
  |     marker scan if fast signals pass
  |     version_signal check if all others pass
  |
  +-- collect matched plugins
  |
  +-- format output based on args.as and args.include
```

## AST Node

New node type added to `packages/parser/src/types.ts`:

```typescript
export interface MarkdownaiDetectNode extends ASTNodeBase {
  type: 'markdownai-detect'
  format: 'text' | 'info'   // from as= arg (default: 'text')
  include: string[]         // sections: 'layout', 'conventions', 'meta', 'detect', 'all'
  label: string | null      // from label= arg - stores result in ctx.envFiles
  projectOverride: string | null  // from project= arg - overrides ctx.cwd
}
```

## Arguments

| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `as=` | `text\|info` | `text` | Output format. `text` = plain lines; `info` = Markdown info block with section headers |
| `include=` | comma-separated | `""` (names only) | Extra sections to include: `layout`, `conventions`, `meta`, `detect`, `all` |
| `label=` | string | none | Store output in context variable for later use |
| `project=` | path | `ctx.cwd` | Override project root for detection |

## Detection Logic

For each loaded plugin, `detectPlugin(plugin, projectRoot)` returns `true` only if ALL specified conditions pass:

1. **Required dirs** (`required_dirs`) - each dir must exist under `projectRoot` using `existsSync`
2. **Required files** (`required_files`) - each file must exist under `projectRoot` using `existsSync`
3. **Required marker** (`required_marker`) - if present, the marker string must exist as a path under `projectRoot` (checked as dir or file)
4. **Version signal** (`version_signal`) - reads the target file, looks for the field, compares expected value using semver-gte if the value looks like a version, otherwise exact match

Fast signals (dirs, files, marker) are checked before the version signal to avoid unnecessary file reads. If any check fails, detection stops early and the plugin is not matched.

## Output Format

### `as=text` (default)

```
mdd (v1.0.0) - MDD Manual-Driven Development
vscode-tools (v2.1.0) - VS Code MarkdownAI Tools
```

If no plugins detected:
```
(no plugins detected)
```

### `as=info` with `include=layout`

```markdown
## Detected Plugins

### mdd (v1.0.0)
MDD Manual-Driven Development

**Layout**
.mdd/                 - MDD root
.mdd/docs/            - Feature documentation
.mdd/waves/           - Wave planning docs

### vscode-tools (v2.1.0)
VS Code MarkdownAI Tools
```

## Sync Loader Extension

`loadPluginsSync()` is added to `plugin-loader.ts`. Since the existing implementation already uses synchronous file I/O (`readdirSync`, `readFileSync`, `existsSync`), the sync variant simply calls the same internal logic without the async wrapper:

```typescript
export function loadPluginsSync(projectRoot = process.cwd()): PluginLoadResult
```

`detectPlugin(plugin: LoadedPlugin, projectRoot: string): boolean` is a new exported function implementing the detection logic above.

## Business Rules

- If `include=all`, all sections (meta, detect, layout, conventions) are rendered where present
- If `include=` includes a section the plugin does not have, that section is silently omitted
- If no plugins are installed (all search paths empty), outputs `(no plugins detected)`
- `required_marker` is treated as a filesystem path - it must exist under `projectRoot`
- `version_signal.type` must be `file` in v1; other types produce a warning and pass-through (non-blocking)
- The `label=` arg stores the plain-text output in `ctx.envFiles[label]` regardless of `as=` format

## Data Flow

Consumer directive - reads from filesystem (plugin files, project directory). Engine context provides `cwd` as default project root.

## Dependencies

- `94-plugin-loader` — `loadPlugins` async API, `LoadedPlugin`, `PluginDetect` types. This feature adds `loadPluginsSync` and `detectPlugin` exports alongside the existing async API.

## Security

Accepts `project=` override from document authors. This is a filesystem path argument that feeds into `existsSync` and `readFileSync` calls during detection. Confinement is not applied to detection reads because detection is intentionally project-aware (it reads project files by design). However:
- Cloud metadata IP ranges are always blocked
- `project=` must not be empty string; empty defaults to `ctx.cwd`
- `version_signal` reads one specific file; the path is taken from the plugin file (trusted source), not from the document author

## Known Issues

(none)
