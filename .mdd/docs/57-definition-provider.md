---
id: 57-definition-provider
title: VS Code Extension - Definition Provider
edition: VS Code Extension
depends_on: [55-completion-provider, 56-hover-provider]
source_files:
  - packages/vscode/src/providers/definition-provider.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/definition-provider.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
tags: [vscode, extension, go-to-definition, navigation, macros, language-provider, markdownai]
path: VS Code Extension/Intelligence
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 57 - VS Code Extension - Definition Provider

## Purpose

Cmd+click (or F12) on `@call macro-name` jumps to the `@define macro-name` block in the file where it is defined - either the current document, an imported file, or stdlib.md. This is standard go-to-definition navigation that makes MarkdownAI documents feel like code.

## Architecture

The definition provider reuses `MacroInfo.filePath` and `MacroInfo.definitionLine` recorded by `scanDocumentMacros`. For stdlib macros, the provider resolves the path to `packages/engine/src/stdlib.md` and finds the `@define` line.

**`definition-provider.ts`:**
- `registerDefinitionProvider(context, registry)` - registers a `vscode.DefinitionProvider`
- On Cmd+click: extract macro name via `extractCallTarget`, find in `getMacros()`, return a `vscode.Location` pointing to the `@define` line

**Pure helper in `macro-registry.ts`:**
- `resolveStdlibPath(workspaceFolders)` - returns the URI to stdlib.md (used to build the Location for stdlib macros)

```
"@call git-status" + Cmd+click
    ↓ extractCallTarget()
"git-status"
    ↓ registry.getMacros(document).find()
MacroInfo { source: 'stdlib', definitionLine: 5 ... }
    ↓ resolveLocation(macro, workspaceFolders)
vscode.Location(stdlibUri, line 5)
    ↓ VS Code jumps to packages/engine/src/stdlib.md line 5
```

## Data Model

Uses `MacroInfo` from `55-completion-provider`. `definitionLine` is the 0-indexed line of `@define macro-name` as stored by `scanDocumentMacros`. For stdlib macros this is also stored by `parseStdlibMacros` (needs adding - see Business Rules).

## API Endpoints

None - VS Code extension feature only.

## Business Rules

- `extractCallTarget` is reused from `56-hover-provider` - no new extraction logic
- For `local` macros: `filePath` is the document URI string, `definitionLine` is the 0-indexed `@define` line
- For `imported` macros: `filePath` is the imported file's URI string, `definitionLine` is the `@define` line within that file
- For `stdlib` macros: `filePath` is the workspace-relative `packages/engine/src/stdlib.md`; `definitionLine` must be stored by `parseStdlibMacros` (added to `MacroInfo` in this feature)
- If `filePath` is undefined or the file cannot be resolved: return `undefined` (no navigation)
- If `definitionLine` is undefined: navigate to line 0 as fallback
- The location points to the `@define name` line (column 0)

## Data Flow

Greenfield. Extends `parseStdlibMacros` to store `definitionLine` for each stdlib macro. All other data flows from feature 55.

## Dependencies

- `55-completion-provider` - provides `MacroRegistry`, `MacroInfo`, `parseStdlibMacros`, `scanDocumentMacros`
- `56-hover-provider` - provides `extractCallTarget` (reused, not extended)

## Security

Read-only navigation. Only opens files from the workspace. `filePath` values come from `scanDocumentMacros` (document URIs) or workspace-relative stdlib path - no user-controlled path injection possible.

## Known Issues

(none)
