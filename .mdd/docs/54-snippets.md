---
id: 54-snippets
title: VS Code Extension - MarkdownAI Snippets
edition: Both
depends_on: [52-language-definition]
source_files:
  - packages/vscode/snippets/markdownai.code-snippets
  - packages/vscode/package.json
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/snippets.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1.6.6
tags: [vscode, extension, snippets, autocomplete, directives, tab-expansion]
path: VS Code Extension/Foundation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 54 - VS Code Extension - MarkdownAI Snippets

## Purpose

Provides tab-expandable snippets for every commonly-used MarkdownAI directive. Typing the prefix and pressing Tab expands to a multi-line template with tab stops, removing the need to remember exact syntax for directives like `@define...@enddefine` or `@if...@endif`.

## Architecture

A single VS Code snippets file (`snippets/markdownai.code-snippets`) registered for the `markdownai` language. VS Code loads this automatically when the `markdownai` language is active. No code runs - the snippets are declarative JSON.

## Data Model

None.

## API Endpoints

None.

## Business Rules

The following snippets are provided (prefix → expanded form):

| Prefix | Expands to |
|--------|-----------|
| `mai` | `@markdownai` (header) |
| `@import` | `@import ./path.md` |
| `@include` | `@include ./path.md` |
| `@define` | `@define name param\n...\n@enddefine` |
| `@call` | `@call macro-name` |
| `@env` | `@env VAR_NAME` |
| `@if` | `@if {{ condition }}\n...\n@endif` |
| `@ifelse` | `@if {{ condition }}\n...\n@else\n...\n@endif` |
| `@query` | `@query label=result command` |
| `@http` | `@http https://...` |
| `@list` | `@list from=./data.json` |
| `@read` | `@read ./file.txt` |
| `{{` | `{{ variable }}` |
| `@prompt` | `@prompt\n# instructions\n` |
| `@section` | `@section name priority=1\n...\n` |
| `@constraint` | `@constraint description` |
| `@define-concept` | `@define-concept Name\nDefinition.` |

All snippets use `$N` tab stops so users can Tab through the placeholders.

## Data Flow

Greenfield.

## Dependencies

Depends on 52-language-definition (snippets activate on `markdownai` language).

## Security

None - snippets are static JSON, no runtime code.

## Known Issues

None.
