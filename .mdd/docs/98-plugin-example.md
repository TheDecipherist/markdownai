---
id: 98-plugin-example
title: Example Plugin (example-framework)
edition: MarkdownAI
depends_on: ["95-plugin-detect-directive", "96-plugin-data-directive"]
relates: ["93-plugin-parser-nodes", "94-plugin-loader"]
source_files:
  - packages/engine/src/__tests__/fixtures/example-framework.plugin.md
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/plugin-detect-directive.test.ts
  - packages/engine/src/__tests__/plugin-data-directive.test.ts
data_flow: greenfield
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [plugin-system, fixtures, testing, plugin-example]
path: Engine/Plugins
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
initiative: markdownai-plugin-system
wave: markdownai-plugin-system-wave-2
wave_status: active
---

# 98 - Example Plugin (example-framework)

## Purpose

A concrete, non-MDD plugin file used by the Wave 2 integration tests. Demonstrates that the plugin system is framework-agnostic by using a fictional `example-framework` as the subject. Tests for features 95 and 96 install this plugin into a temp `.markdownai/plugins/` directory and assert that detection and data retrieval work correctly.

## Architecture

A single `*.plugin.md` fixture file containing all four plugin blocks. The tests for features 95 and 96 copy it into a temp project directory and call `loadPluginsSync`, `detectPlugin`, and the engine directives against it.

## Plugin File Content

Filename: `example-framework.plugin.md`

The plugin describes a fictional framework called `ExampleFramework` that uses a `.exf/` directory and an `exf.config.json` file as its presence signals.

```
---
markdownai_plugin: "1.0"
plugin_name: example-framework
plugin_version: 1.0.0
description: ExampleFramework project integration
homepage: https://example-framework.dev
---

@markdownai v1.0

# ExampleFramework Plugin

This plugin registers ExampleFramework projects so MarkdownAI can detect them.

@plugin-meta
  framework_name: ExampleFramework
  framework_version: ">=1.0.0"
  marker_version: exf-v1
@end

@plugin-detect
  required_dirs:
    - .exf
  required_files:
    - exf.config.json
@end

@plugin-layout
  directories:
    .exf/: ExampleFramework root directory
    .exf/templates/: Template files
  files:
    exf.config.json: Main configuration file
@end

@plugin-conventions
  naming:
    template_files: kebab-case with .exf.md extension
@end
```

## Business Rules

- Filename must be `example-framework.plugin.md` so `plugin_name` matches the stem
- `required_dirs` and `required_files` refer to paths relative to `projectRoot` - tests must create these
- No executable directives - file must pass the plugin loader's allowed-node-types check
- File must parse cleanly with the current parser

## Data Flow

Greenfield - this is a new fixture file, not modifying existing code.

## Dependencies

- `95-plugin-detect-directive` — tests use this fixture to verify detection works
- `96-plugin-data-directive` — tests use this fixture to verify plugin data retrieval works

## Known Issues

(none)
