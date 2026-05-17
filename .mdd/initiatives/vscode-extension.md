---
id: vscode-extension
title: VS Code Extension
status: active
version: 1
hash:
created: 2026-05-17
---

# VS Code Extension

## Overview

A VS Code extension (`@markdownai/vscode`) that makes MarkdownAI documents a first-class editing experience. Every directive, macro, and `{{ }}` expression gets syntax highlighting, autocomplete with inline docs, hover documentation, and go-to-definition navigation.

The extension activates automatically on any `.md` file whose first line is `@markdownai`. No configuration required - open the file, the editor becomes aware.

**Architecture: direct VS Code extension (not LSP).** The VS Code Extension API provides all needed hooks (CompletionItemProvider, HoverProvider, DefinitionProvider, DiagnosticsCollection) without the overhead of a separate language server process. If multi-editor support (Neovim, Zed) becomes a goal later, the providers can be extracted into an LSP server as a separate initiative. The VS Code-only approach ships faster and is fully testable with `@vscode/test-cli`.

New package at: `packages/vscode/`

## Open Product Questions

(none - architecture resolved: direct VS Code extension, not LSP)

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 1 | waves/vscode-extension-wave-1.md | Open a `.md` file with `@markdownai` - directives, `{{ }}` interpolations, and macro names light up in distinct colors. Snippets available via tab. | complete |
| Wave 2 | waves/vscode-extension-wave-2.md | Type `@call ` and see every stdlib macro with its description and the label it sets. Hover over `@call git-status` to see "Sets {{ git_status }}". Cmd+click any `@call` to jump to its `@define`. | complete |
| Wave 3 | waves/vscode-extension-wave-3.md | `npm test` runs green in `packages/vscode`. An unclosed `@if` shows a red squiggly. README documents every feature. | planned |
