---
id: 94-plugin-loader
title: Plugin Loader
edition: MarkdownAI
depends_on: ["93-plugin-parser-nodes"]
relates: ["93-plugin-parser-nodes"]
source_files:
  - packages/engine/src/plugin-loader.ts
  - packages/engine/src/index.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/plugin-loader.test.ts
data_flow: reads-existing
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [plugin-system, loader, filesystem, validation, cache, plugin-meta, plugin-detect, plugin-layout, plugin-conventions]
path: Engine/Plugins
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/plugin-loader.ts (all search-path reads)
known_issues: []
initiative: markdownai-plugin-system
wave: markdownai-plugin-system-wave-1
wave_status: active
---

# 94 - Plugin Loader

## Purpose

Scans three filesystem search paths for `*.plugin.md` files, parses and validates each one, and returns a typed JS API with the loaded plugin descriptors. Consumed by Wave 2 engine directives (`@markdownai-detect`, `@plugin-data`) and the `available_directives` MCP tool. The loader enforces the security invariant that plugin files contain no executable directives.

## Architecture

A standalone async module in the engine package. It does not depend on `EngineContext` — its only runtime dependencies are `@markdownai/parser`, Node.js `fs`/`path`, and `frontmatter-utils.ts` from this package.

```
loadPlugins(projectRoot?)
  |
  +-- scan 3 paths for *.plugin.md
  |     <project>/.markdownai/plugins/
  |     ~/.markdownai/plugins/
  |     /usr/share/markdownai/plugins/
  |
  +-- for each file (higher-precedence path wins on plugin_name collision):
  |     readFileSync
  |     extractFrontmatter -> validate required fields
  |     check plugin_name matches filename stem
  |     parse(content) -> ASTNode[]
  |     validate: no executable nodes in AST
  |     extract plugin-meta, plugin-detect, plugin-layout, plugin-conventions nodes
  |     parsePluginBody(node.body) -> typed object
  |     build LoadedPlugin descriptor
  |
  +-- cache result for process lifetime (session-scoped Map)
  +-- return { plugins: LoadedPlugin[], warnings: string[] }
```

## Data Model

```typescript
// Public types exported from packages/engine/src/plugin-loader.ts

interface VersionSignal {
  type: string      // e.g. "frontmatter-field"
  target: string    // e.g. ".mdd/docs/*.md"
  field: string     // e.g. "mdd_version"
  expected: string  // e.g. "2"
}

interface PluginMeta {
  framework_name: string
  framework_version: string
  marker_version: string
}

interface PluginDetect {
  required_marker?: string
  required_files?: string[]
  required_dirs?: string[]
  version_signal?: VersionSignal
}

interface PluginLayout {
  directories?: Record<string, string>
  files?: Record<string, string>
  tree?: string
}

interface PluginConventions {
  naming?: Record<string, string>
  required_frontmatter_fields?: string[]
}

interface LoadedPlugin {
  name: string          // from plugin_name frontmatter
  version: string       // from plugin_version frontmatter
  description?: string  // from description frontmatter (optional)
  homepage?: string     // from homepage frontmatter (optional)
  sourcePath: string    // absolute path to the .plugin.md file
  meta: PluginMeta
  detect: PluginDetect
  layout?: PluginLayout
  conventions?: PluginConventions
}

interface PluginLoadResult {
  plugins: LoadedPlugin[]
  warnings: string[]    // non-fatal issues: skipped files with reason
}
```

## API

```typescript
// Load all plugins from the three search paths
loadPlugins(projectRoot?: string): Promise<PluginLoadResult>

// Retrieve a single plugin by name (returns null if not loaded)
getPlugin(name: string, projectRoot?: string): Promise<LoadedPlugin | null>

// Clear the in-process cache
clearPluginCache(): void
```

The `projectRoot` parameter defaults to `process.cwd()`. It is used only to resolve the project-local path.

## Business Rules

**Search paths (precedence: high to low):**
1. `<projectRoot>/.markdownai/plugins/*.plugin.md`
2. `~/.markdownai/plugins/*.plugin.md`
3. `/usr/share/markdownai/plugins/*.plugin.md`

**On `plugin_name` collision:** the plugin from the highest-precedence path wins. A warning is emitted naming the overridden file.

**Validation — each plugin file must:**
- Have a YAML frontmatter block (FRONTMATTER_RE from frontmatter-utils.ts)
- Contain `markdownai_plugin` field (must be present; value is the schema version, e.g. `"1.0"`)
- Contain `plugin_name` field (kebab-case identifier matching the filename stem without `.plugin.md`)
- Contain `plugin_version` field
- Have `plugin_name` equal to the filename stem — mismatch is a hard error, plugin is skipped
- After parsing with `@markdownai/parser`, the AST must contain no node types outside the allowed set (below)
- Contain at least one `@plugin-meta` block
- Contain at least one `@plugin-detect` block

**Allowed AST node types in plugin files:**

```
markdown, passthrough, header, note, define-concept, constraint,
plugin-meta, plugin-detect, plugin-layout, plugin-conventions
```

Any other node type (including `if`, `http`, `db`, `read`, `query`, `include`, `import`, `define`, `call`, `phase`, `set`, `foreach`, `render`, etc.) causes the plugin to be skipped with a warning. This is the security invariant: plugin files cannot contain executable directives.

**Parsing plugin block bodies:**
The body of each plugin block is raw indented YAML-like text. A minimal `parsePluginBody()` function handles:
- Scalar: `key: "quoted"` or `key: unquoted`
- List: `key:` followed by `  - item` lines
- Nested object: `key:` followed by `  subkey: value` lines
- Multi-line string: `key: |` followed by indented lines (used for `tree:` in `@plugin-layout`)

Unknown keys are silently ignored, allowing forward compatibility.

**Caching:** Results are cached in a module-level `Map<string, PluginLoadResult>`. The cache key is the `projectRoot`. `clearPluginCache()` wipes it. The cache is process-lifetime only (no persistence). This matches the "for the duration of the render" requirement in the design.

## Data Flow

Reads from:
- Filesystem: 3 plugin search paths (pure read, no write)
- `@markdownai/parser`: `parse()` to produce AST for validation
- `frontmatter-utils.ts`: `extractFrontmatter()`, `readFrontmatterField()`

Nothing is modified. Output is returned in memory only.

## Dependencies

- `93-plugin-parser-nodes` — provides `PluginMetaNode`, `PluginDetectNode`, `PluginLayoutNode`, `PluginConventionsNode` types needed to extract structured data from parsed AST

## Security

**Threat model:** Plugin files are auto-discovered from the filesystem and loaded without user confirmation. A malicious `*.plugin.md` file dropped into any of the three search paths would be executed unless the loader enforces content validation.

**Enforcement:**
- The AST allowed-type check runs on every loaded plugin file before any body data is extracted
- Files with any disallowed node type are skipped entirely — they are not partially loaded
- The loader does NOT execute the plugin file through the engine — it only parses (AST only, no evaluation)
- No environment variable access, no shell execution, no network calls are possible during plugin loading

**Filesystem confinement:** The loader only reads from the three declared search paths. It uses `fs.readdirSync` with a glob pattern limited to `*.plugin.md`. It does not follow symlinks or traverse subdirectories.

**Inputs are untrusted:** Plugin file content is untrusted. Every field extracted is treated as a plain string — no expression evaluation, no interpolation. The loader does not call `evalExpression()` or any engine evaluation function.

## Known Issues

(none)

## Bugs

(none yet)
