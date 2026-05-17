---
id: 58-reference-panel
title: VS Code Extension - Reference Panel
edition: VS Code Extension
depends_on: [55-completion-provider]
source_files:
  - packages/vscode/src/providers/reference-provider.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/reference-provider.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
tags: [vscode, extension, references, find-usages, macros, language-provider, markdownai]
path: VS Code Extension/Intelligence
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 58 - VS Code Extension - Reference Panel

## Purpose

"Find All References" (Shift+F12) on a `@call macro-name` or `@define macro-name` line shows every `@call macro-name` usage in the document in the References panel. This completes the code-navigation experience: you can jump to definition (feature 57) or find all call sites in one keystroke.

## Architecture

A pure function in `macro-registry.ts` (testable) plus a VS Code provider in `reference-provider.ts`:

**In `macro-registry.ts` (extended):**
- `findCallSites(text: string, macroName: string, filePath: string): CallSite[]` - scans document text and returns all `@call macro-name` occurrences with file/line/character positions

**`reference-provider.ts`:**
- `registerReferenceProvider(context, registry)` - registers a `vscode.ReferenceProvider`

```
"@define git-status" + Shift+F12
    ↓ extractCallTarget()
"git-status"
    ↓ findCallSites(document.getText(), "git-status", document.uri)
CallSite[]
    ↓ map to vscode.Location[]
References panel shows all @call git-status lines
```

## Data Model

```typescript
interface CallSite {
  filePath: string;
  line: number;       // 0-indexed line of @call
  startChar: number;  // 0-indexed char of start of macro name in the @call line
  endChar: number;    // 0-indexed char of end of macro name
}
```

The `startChar`/`endChar` point to the macro name within the `@call macro-name` line, so VS Code highlights the name in the References panel.

## API Endpoints

None - VS Code extension feature only.

## Business Rules

- Trigger: "Find All References" on any `@call` or `@define` line (uses `extractCallTarget` to get macro name)
- Scans only the current document (cross-file reference scanning is Wave 3 scope)
- Returns one `vscode.Location` per `@call macro-name` line found
- Also includes the `@define macro-name` location in results if the macro is defined locally
- If `extractCallTarget` returns null: return empty array
- `findCallSites` is a pure function of document text - no async, no VS Code API

## Data Flow

Greenfield. Extends `macro-registry.ts` with `findCallSites`. All macro data flows from `55-completion-provider`.

## Dependencies

- `55-completion-provider` - provides `MacroRegistry` and `extractCallTarget` (from `macro-registry.ts`)

## Security

Read-only. Scans only document text in memory. No file I/O beyond what VS Code already provides.

## Known Issues

(none)
