---
id: 55-completion-provider
title: VS Code Extension - Completion Provider
edition: VS Code Extension
depends_on: [51-package-scaffold, 52-language-definition]
source_files:
  - packages/vscode/src/providers/macro-registry.ts
  - packages/vscode/src/providers/completion-provider.ts
  - packages/vscode/src/extension.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/completion-provider.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
tags: [vscode, extension, completions, intellisense, macros, stdlib, language-provider, markdownai]
path: VS Code Extension/Intelligence
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 55 - VS Code Extension - Completion Provider

## Purpose

When the user types `@call ` inside a `markdownai` document, an IntelliSense popup lists every available macro - stdlib macros auto-loaded from `packages/engine/src/stdlib.md` and user-defined `@define` blocks from the current file and any `@import`ed files (one level deep). Each completion item shows the macro name, what label variable it sets, and a description of what it does.

## Architecture

Two modules, registered in `extension.ts activate()`:

**`macro-registry.ts`** - owns all macro discovery and caching. At activation it reads `packages/engine/src/stdlib.md` from the workspace root, parses the HTML comment metadata above each `@define` block, and builds an in-memory `MacroInfo[]` cache. This shared registry is also used by the hover and definition providers (waves 2+3). It exposes two functions:
- `getMacros(document: vscode.TextDocument): MacroInfo[]` - returns stdlib macros + macros defined in the given document + macros from that document's `@import` targets (one level)
- `getStdlibMacros(): MacroInfo[]` - returns the cached stdlib list only

**`completion-provider.ts`** - implements `vscode.CompletionItemProvider`. Registered for language `markdownai` with trigger character `' '` (space). Triggers only when the current line text before the cursor matches `/@call\s+\S*$/` - i.e., the cursor is positioned after `@call ` and possibly a partial macro name. Returns one `CompletionItem` per macro.

```
stdlib.md (workspace)
    ↓ parsed once at activate()
MacroRegistry (in-memory cache)
    ↑ queried per document
CompletionProvider.provideCompletionItems()
    ↓
vscode.CompletionList → IntelliSense popup
```

## Data Model

```typescript
interface MacroInfo {
  name: string;          // macro name, e.g. "git-status"
  label: string;         // output variable, e.g. "git_status"
  description: string;   // joined comment lines (excluding the name→label line and Usage line)
  source: 'stdlib' | 'local' | 'imported';
  filePath?: string;     // absolute path — used by definition provider
  definitionLine?: number; // 0-indexed line of @define — used by definition provider
}
```

## API Endpoints

None - VS Code extension feature only.

## Business Rules

- Trigger condition: cursor is on a line matching `/@call\s+\S*$/` after the user types a space
- Completion list is empty (no error) if no macros are found
- Sort order: local (user-defined) first, imported second, stdlib last
- Insert text: the macro name only (not `@call` - that's already typed)
- CompletionItemKind: `Function` for all macros
- Detail line (shown in popup): `→ {{ label_variable }}`
- Documentation (shown on right panel): description lines joined with newlines
- Stdlib source: `packages/engine/src/stdlib.md` read via `vscode.workspace.fs` from the first `workspaceFolder` root; silently produces empty list if file not found (extension may be used outside this monorepo)
- Import scanning: parse `@import path/to/file` lines at the top of the document, resolve relative to document directory, read each imported file for `@define` blocks; one level only (no recursive @import traversal)
- Stdlib parsing: find `<!-- name → label ... -->` comment blocks immediately before `@define name` lines; extract name (before →), label (after →, trimmed of trailing whitespace/padding), and description (subsequent `<!-- ... -->` comment lines, excluding the `<!-- Usage: ... -->` line)

## Data Flow

Greenfield - no existing providers or macro-parsing code exists in the extension.

The stdlib.md parse runs once at activation and is cached. Document-level scanning runs per `provideCompletionItems()` call. Import file reads use `vscode.workspace.fs.readFile()` (async, non-blocking).

## Dependencies

- `51-package-scaffold` - provides the `packages/vscode/` package structure and `extension.ts` activation hook
- `52-language-definition` - registers the `markdownai` language ID that the completion provider targets

## Security

The completion provider reads files from the workspace only:
- Stdlib path is resolved from `workspaceFolder[0].uri` - cannot escape the workspace
- Import paths are resolved relative to the current document - no absolute path injection possible
- All file reads are read-only; no writes occur
- No user input is eval'd or executed

## Known Issues

(none)
