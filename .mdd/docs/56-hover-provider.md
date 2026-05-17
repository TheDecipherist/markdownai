---
id: 56-hover-provider
title: VS Code Extension - Hover Provider
edition: VS Code Extension
depends_on: [55-completion-provider]
source_files:
  - packages/vscode/src/providers/hover-provider.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/hover-provider.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
tags: [vscode, extension, hover, tooltip, macros, documentation, language-provider, markdownai]
path: VS Code Extension/Intelligence
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 56 - VS Code Extension - Hover Provider

## Purpose

Hovering over `@call macro-name` (or `@define macro-name`) in a `markdownai` document shows a tooltip with the macro's description, the label variable it sets, and where it is defined (stdlib vs local). This gives users inline documentation without leaving the editor.

## Architecture

Two pure functions added to `macro-registry.ts` (testable without VS Code API), plus a VS Code provider registration in `hover-provider.ts`:

**In `macro-registry.ts` (extended):**
- `extractCallTarget(lineText: string, cursorChar: number): string | null` - parses the macro name from a `@call name` or `@define name` line at the cursor position
- `formatHoverMarkdown(macro: MacroInfo): string` - formats hover content as markdown string

**`hover-provider.ts`:**
- `registerHoverProvider(context, registry)` - registers a `vscode.HoverProvider` for `markdownai` that calls the above pure functions and wraps the result in `vscode.MarkdownString`

```
Document line "@call git-status"
    ↓ extractCallTarget(line, cursorChar)
"git-status"
    ↓ registry.getMacros(document).find(name === "git-status")
MacroInfo
    ↓ formatHoverMarkdown(macro)
Markdown string
    ↓ new vscode.Hover(new vscode.MarkdownString(md))
Tooltip popup
```

## Data Model

Uses `MacroInfo` from `55-completion-provider`. No new types introduced.

## API Endpoints

None - VS Code extension feature only.

## Business Rules

- Hover triggers on any character position on lines matching `@call\s+[\w-]+` or `@define\s+[\w-]+`
- `extractCallTarget` returns `null` if the line is not a `@call` or `@define` line
- If the macro is not found in the registry: return `undefined` (no hover shown)
- Hover markdown format:
  ```
  **macro-name** (stdlib | local | imported)
  → sets `{{ label_variable }}`

  Description text here.
  ```
- If `label` is empty: omit the "→ sets" line
- If `description` is empty: omit the description paragraph
- For `@define` lines: show "defined here" instead of source badge

## Data Flow

Greenfield - extends `macro-registry.ts` with two pure functions; all macro data flows from `55-completion-provider` `MacroRegistry` instance shared via `extension.ts`.

## Dependencies

- `55-completion-provider` - provides `MacroRegistry`, `MacroInfo`, and the shared registry instance initialized at activation

## Security

Read-only tooltip rendering. No user input evaluated. No file writes.

## Known Issues

(none)
