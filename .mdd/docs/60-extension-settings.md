---
id: 60-extension-settings
title: Extension Settings
edition: VS Code Extension
depends_on: []
source_files:
  - packages/vscode/src/settings.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/settings.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
initiative: vscode-extension
wave: vscode-extension-wave-3
wave_status: active
tags: [settings, configuration, vscode, extension, diagnostics]
path: VS Code Extension/Foundation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 60 - Extension Settings

## Purpose

Registers VS Code configuration contributions for the MarkdownAI extension and provides typed accessor functions for reading them. Gives users control over diagnostics behavior and the stdlib path.

## Architecture

Two parts:

1. `package.json` `contributes.configuration` block - declares the settings schema (title, type, default, description). VS Code reads this to populate the Settings UI automatically.
2. `settings.ts` - typed getter functions that read from `vscode.workspace.getConfiguration('markdownai')`. Uses dependency injection for the config getter so the logic is unit-testable without the VS Code runtime.

```
package.json
  contributes.configuration
    markdownai.diagnostics.enabled
    markdownai.diagnostics.warnUndefinedMacros
    markdownai.stdlibPath

settings.ts
  getSettings(getConfig?) → MarkdownAISettings
  readDiagnosticsEnabled(config) → boolean
  readWarnUndefinedMacros(config) → boolean
  readStdlibPath(config) → string
```

## Data Model

No persistent storage. Settings come from VS Code's configuration system.

```typescript
interface MarkdownAISettings {
  diagnosticsEnabled: boolean;
  warnUndefinedMacros: boolean;
  stdlibPath: string;
}
```

## API Endpoints

None.

## Business Rules

- `markdownai.diagnostics.enabled` (boolean, default: `true`) - when false, the DiagnosticsProvider skips all analysis and clears existing diagnostics.
- `markdownai.diagnostics.warnUndefinedMacros` (boolean, default: `true`) - when false, the reference pass is skipped; only structural errors are reported. Only applies when `diagnostics.enabled` is true.
- `markdownai.stdlibPath` (string, default: `"packages/engine/src/stdlib.md"`) - relative path from workspace root to the stdlib macro definitions file. Used by MacroRegistry.initialize().

## Data Flow

Greenfield - settings are read from VS Code configuration on demand. No upstream data transformation.

## Dependencies

None.

## Security

Settings are user-controlled configuration values. No sanitization required - all values are typed primitives (boolean, string) consumed internally. The `stdlibPath` is a file path read by `vscode.Uri.joinPath`, which is safe.

## Known Issues

(none)
