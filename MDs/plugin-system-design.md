---
title: Plugin System Design
status: design-draft
audience: MarkdownAI contributors
created: 2026-05-25
---

@markdownai v1.0

# Plugin System Design

## Motivation

MarkdownAI is a substrate. Frameworks built on top (MDD is one example, but the design must be framework-agnostic) need a way to:

- Register themselves with MarkdownAI so introspection directives can detect their presence
- Declare expected directory layout so consumers do not have to guess (this prevents bugs like the one observed during mdd2 Wave 6 planning, where a flow author inferred `.mdd/features/` as the v2 layout when that path does not exist)
- Surface framework-specific conventions to tools and users

Without a registered descriptor, every consumer reinvents detection logic from training data, hand-rolled greps, or worse, hallucination. With one, detection becomes a single directive call that returns ground truth.

## Non-Goals

- MarkdownAI core does not learn about specific frameworks. The MDD plugin lives in the mdd2 repo, not here.
- Plugins are not executable. They do not contain directives that run code. They are pure declarative data.
- This is not a generic mechanism for shipping new core directives. Plugins describe frameworks; they do not extend the directive set.

## Plugin File Format

One MarkdownAI document per plugin. Conventional extension: `.plugin.md`.

Frontmatter declares plugin identity. The body uses dedicated `@plugin-*` block directives to declare structured framework knowledge.

Example (the canonical MDD plugin that will ship from the mdd2 repo):

```
---
markdownai_plugin: "1.0"
plugin_name: "mdd"
plugin_version: "2.0"
description: "MDD v2 framework descriptor"
homepage: "https://github.com/TheDecipherist/mdd2"
---
@markdownai v2.0

# MDD MarkdownAI Plugin

@plugin-meta
  framework_name: "MDD"
  framework_version: "2.0"
  marker_version: "2.0"
@end

@plugin-detect
  required_marker: "@markdownai v2.0"
  required_files:
    - ".mdd/settings.json"
  required_dirs:
    - ".mdd/docs/"
  version_signal:
    type: "frontmatter-field"
    target: ".mdd/docs/*.md"
    field: "mdd_version"
    expected: "2"
@end

@plugin-layout
  directories:
    features: ".mdd/docs/"
    waves: ".mdd/waves/"
    initiatives: ".mdd/initiatives/"
    ops: ".mdd/ops/"
    audits: ".mdd/audits/"
    jobs: ".mdd/jobs/"
  files:
    settings: ".mdd/settings.json"
    startup: ".mdd/.startup.md"
  tree: |
    .mdd/
      docs/         # feature docs
      waves/        # wave planning
      initiatives/  # initiative planning
      ops/          # runbooks
      audits/       # audit reports
      jobs/         # background state
      settings.json
@end

@plugin-conventions
  naming:
    feature_doc: "<NN>-<feature-slug>.md"
    wave_doc: "<framework>-build-wave-<N>.md"
  required_frontmatter_fields:
    - id
    - title
    - status
@end
```

### Required frontmatter fields

| Field | Required | Purpose |
|---|---|---|
| `markdownai_plugin` | yes | Schema version. Currently `"1.0"`. Allows future evolution. |
| `plugin_name` | yes | Unique identifier (kebab-case). Used as the lookup key. **Must match the filename stem** (the file `mdd.plugin.md` requires `plugin_name: "mdd"`). The loader errors on mismatch. |
| `plugin_version` | yes | Plugin's own version (semver). Independent of framework version. |
| `description` | recommended | One-line summary for plugin listings. |
| `homepage` | optional | Where users can learn more or report issues. |

### Block directives

| Block | Required | Purpose |
|---|---|---|
| `@plugin-meta` | yes | Framework identity: name, version, marker version |
| `@plugin-detect` | yes | How to recognize the framework in a project |
| `@plugin-layout` | optional | Expected directory and file layout |
| `@plugin-conventions` | optional | Naming patterns, required fields, free-form framework knowledge |

## Plugin Identity and Access

### Plugin identity

A plugin's canonical name comes from **both** its filename stem and its `plugin_name` frontmatter field. These must match. The loader errors on mismatch:

```
ERROR: plugin file mdd.plugin.md declares plugin_name "mdd-v2"; expected "mdd"
```

This double-signal is intentional. Readers see the plugin name at the filesystem (when listing the plugins directory) and inside the file (when opening it). A rename without updating the field is caught at load time. Same pattern as npm `package.json` "name" + directory name, or Cargo `Cargo.toml` "name" + crate dir.

Filename convention: lowercase kebab-case, suffix `.plugin.md`. Examples:

- `mdd.plugin.md` -> `plugin_name: "mdd"`
- `jekyll.plugin.md` -> `plugin_name: "jekyll"`
- `obsidian-vault.plugin.md` -> `plugin_name: "obsidian-vault"`

### Access from consumers

Plugins are pure data. They are loaded and queried; they do not execute and do not expose methods. **There is no plugin wrapper function. There is no namespace-prefixed directive syntax** (no `@mdd:layout`, no `@plugin("mdd").layout`). Plugins describe; consumers read.

Two directives read plugin data:

**1. `@markdownai-detect`** -- project introspection. Returns all matching plugins as part of its result struct. Used when a consumer wants to know what frameworks the project actually uses (which may be zero, one, or several).

```
@markdownai-detect as=info include="layout"

@if {{ "mdd" in info.frameworks }}
  Feature docs live in: {{ info.frameworks.mdd.layout.directories.features }}
@endif
```

**2. `@plugin-data name="X" as=NAME`** -- direct access to a specific plugin's descriptor without scanning the project. Used when a consumer already knows which plugin they want and just needs its declared data. Faster than `@markdownai-detect` because it skips the project walk:

```
@plugin-data name="mdd" as=mdd
Feature docs live in: {{ mdd.layout.directories.features }}
```

`@plugin-data` errors if the named plugin is not loaded:

```
ERROR: @plugin-data: no plugin registered with name "mdd". Available: jekyll, obsidian-vault.
```

### Why no plugin methods

Plugins are descriptors, not executables. If a plugin needs to expose computed answers (e.g., "given this feature slug, what's the canonical filename?"), the right place for that logic is in the consumer (mdd2, jekyll-ai, etc.), not in the plugin file. The plugin file declares the inputs (naming pattern: `<NN>-<feature-slug>.md`); the consumer computes the answer.

This keeps plugins inspectable. A user can read `mdd.plugin.md` top to bottom and know everything the plugin tells MarkdownAI. No hidden logic, no eval surfaces.

## Discovery and Loading

Three search paths, precedence top to bottom:

| Path | Scope |
|---|---|
| `<project>/.markdownai/plugins/*.plugin.md` | Project-local override |
| `~/.markdownai/plugins/*.plugin.md` | User-level |
| `/usr/share/markdownai/plugins/*.plugin.md` | System-level (rare) |

Loading procedure:

1. On first directive call that needs plugin data, scan all three paths.
2. Parse each file. Validate against the plugin schema.
3. If a plugin is invalid, log a warning naming the file and the validation failure. Skip it. Do not break the host.
4. If two plugins declare the same `plugin_name`, the higher-precedence path wins. Log the override.
5. Cache the result for the duration of the render.

## `@markdownai-detect` Core Directive

```
@markdownai-detect [as=NAME] [include="layout,structure,paths,counts"] [cache=true]
```

Returns a struct:

| Field | Type | Always present? | Meaning |
|---|---|---|---|
| `detected` | boolean | yes | Any `@markdownai vN.M` markers found in project `.md` files. |
| `version` | string | when `detected` | Highest marker version found. |
| `count` | number | yes | How many docs have a marker. |
| `sample_paths` | string[] | with `include="paths"` or `"all"` | Up to three example marked files (debugging). |
| `frameworks` | object[] | with `include="layout"` or `"all"` | Plugins whose `@plugin-detect` matched this project. Each entry carries the plugin's `@plugin-meta`, `@plugin-layout`, `@plugin-conventions` data. |

The `include` option is comma-separated and additive: `include="layout"` adds framework matching, `include="all"` returns everything.

### Detection algorithm

1. Walk project `.md` files (data-jailed to project root). Record marker presence and version.
2. For each loaded plugin, run its `@plugin-detect` block against the project:
   - Marker check: does the project have any doc with the declared `required_marker`?
   - File checks: do the declared `required_files` exist?
   - Directory checks: do the declared `required_dirs` exist?
   - Version signal: read the declared frontmatter field on a matching file, compare to expected.
3. A plugin matches when all of its detection checks pass.
4. Return all matching plugins in `frameworks`.

### Usage in consumer flows

```
@markdownai-detect as=info include="layout"

@if {{ "mdd" in info.frameworks }}
  *(MDD v{{ info.frameworks.mdd.framework_version }} detected.)*

  Expected layout:
  {{ info.frameworks.mdd.layout.tree }}
@else
  @constraint[critical] noException=true
  This project is not an MDD repo. Run `mdd2 init` or `mdd2 migrate`.
  @end
  @on complete -> halt
@endif
```

## `available_directives` MCP Tool

Independent feature bundled into the same release. Exposes the directive catalog via MCP so consumers can discover what directives exist without grepping source.

```
mcp__markdownai__available_directives({
  category?: "introspection" | "data-sources" | "control-flow" | "all",
  format?: "compact" | "full"
})
```

Returns directive metadata: name, syntax, parameters, examples, security implications, category, and whether the directive is plugin-aware.

This was the original Wave 6 feature 1 ask from mdd2. Bundling it here makes the markdownai 1.2.0 release a coherent "introspection and extensibility" theme.

## Security Model

Plugins are pure declarative data. No `@if`, no `@http`, no `@db`, no executable directives in plugin bodies. The plugin loader validates this at parse time and rejects plugins containing executable directives.

Rationale: plugins are discovered from the filesystem and loaded automatically. A plugin with executable directives would be remote code execution by drop-a-file. Frameworks that need active logic ship that logic in their own consumer code, not in their plugin descriptor.

The plugin loader operates within the existing MarkdownAI security jail. Plugin files outside the three search paths are never loaded.

## Example Non-MDD Plugin (Repo-Internal)

To prove the abstraction is framework-agnostic, the repo ships at least one non-MDD plugin. Candidates:

- Static site generators (`jekyll.plugin.md`, `hugo.plugin.md`)
- Note-taking systems (`obsidian.plugin.md`, `logseq.plugin.md`)
- A fictional "test framework" plugin used in the test suite

The example plugin must be loaded, detected against a fixture project, and its layout returned correctly by `@markdownai-detect`. This is the gate on the design's layer-cleanness claim.

## Release

Ships as `@markdownai/* 1.2.0`. Minor bump because the additions are purely additive:

- New core directive: `@markdownai-detect`
- New parser node types for `@plugin-*` blocks
- New MCP tool: `available_directives`
- New loader subsystem
- No breaking changes to existing directives, syntax, or APIs

## Out of Scope

These belong in future versions or follow-on features:

- Plugin versioning across MarkdownAI major versions (deferred until needed)
- Plugins shipping their own directives (intentionally not supported, see Non-Goals)
- A plugin marketplace or registry server (community plugins live wherever they like; users copy them locally)
- Auto-update of plugins (treat plugins as user-managed config)

## Open Questions

To resolve during implementation:

1. Should `@plugin-detect` support arbitrary boolean composition (AND/OR/NOT) of its checks, or is "all must pass" sufficient?
2. Does `@markdownai-detect` skip the project scan if a plugin's checks pass on faster signals (file existence) before falling back to content scans?
3. Where should plugin authors document their plugin's user-facing usage: inside the plugin file (rendered prose) or in a separate doc?
4. Should `mai init` learn to install or update plugins? (Probably yes for the canonical MDD plugin once it ships in mdd2.)

## Build Order

**Wave 1 (Foundation):**

1. Plugin file format spec finalization (this doc + parser test cases)
2. Plugin loader: scan, parse, validate, cache, expose JS API

**Wave 2 (Consumers):**

3. `@markdownai-detect` core directive
4. `available_directives` MCP tool
5. Example non-MDD plugin
6. Plugin author guide in `MDs/` or `docs/`

## After Shipping

mdd2 extends its install command to write `~/.markdownai/plugins/mdd.plugin.md` (the canonical MDD plugin) on every install. The mdd2 build flow gains a v2-layout assertion using `@markdownai-detect`, fixing the hallucination bug observed during Wave 6 planning. mdd2 Wave 6 resumes.

## References

- Conversation thread that produced this design (mdd2 working tree, 2026-05-25 session)
- mdd2 architecture spec for D30 cross-repo change protocol
- markdownai existing initiative pattern in `.mdd/initiatives/markdownai-*.md`
