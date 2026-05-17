---
id: 59-diagnostics-provider
title: Diagnostics Provider
edition: VS Code Extension
depends_on: [55-completion-provider]
source_files:
  - packages/vscode/src/providers/diagnostics-engine.ts
  - packages/vscode/src/providers/diagnostics-provider.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/diagnostics-provider.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
initiative: vscode-extension
wave: vscode-extension-wave-3
wave_status: active
tags: [diagnostics, vscode, linting, structural-validation, errors, warnings, markdownai]
path: VS Code Extension/Quality
integration_contracts: []
satisfies_contracts:
  - from: 55-completion-provider
    function: MacroRegistry.getMacros(document)
    when: before reporting undefined-macro warnings
    status: verified: packages/vscode/src/providers/diagnostics-provider.ts:29
known_issues: []
---

# 59 - Diagnostics Provider

## Purpose

Surfaces structural errors and undefined macro references as VS Code diagnostics (squiggly underlines). Unclosed `@if`/`@define`/`@phase` blocks become red errors; `@call` references to macros not defined anywhere in scope become yellow warnings.

## Architecture

A single `DiagnosticsProvider` class registers a `vscode.DiagnosticCollection` and updates it on document open and change events. It runs two passes over the document text:

1. **Structural pass** - tracks `@if`/`@endif`, `@define`/`@end`, `@phase`/`@end` nesting. Any block that opens without closing becomes an error diagnostic on the opening line.
2. **Reference pass** - collects every `@call macroName` and checks it against the union of local definitions and stdlib macros via `MacroRegistry`. Unknown names become warning diagnostics on the `@call` line.

The provider is wired into `extension.ts` alongside the other providers on `activate`.

```
extension.ts
  └── DiagnosticsProvider.register(context, registry)
        ├── onDidOpenTextDocument  → analyzeDocument(doc)
        ├── onDidChangeTextDocument → analyzeDocument(doc)
        └── onDidCloseTextDocument  → collection.delete(doc.uri)
```

## Data Model

No storage. All diagnostics are computed on the fly from document text and discarded when the document closes.

## API Endpoints

None.

## Business Rules

**Structural validation rules:**
- `@if <condition>` opens a block; `@endif` closes it. Nesting is supported.
- `@define <name>` and `@phase <name>` open blocks; `@end` closes them.
- Any open block at end-of-document is an error. The error range is the opening line.
- Multiple errors in the same document are all reported (not first-error-only).
- `@elseif` and `@else` within an `@if` block are valid - they do not close or open additional diagnostic tracking.

**Reference validation rules:**
- A `@call macroName` referencing a macro not found in `MacroRegistry.getMacros(document)` produces a `Warning` severity diagnostic.
- The diagnostic range covers just the macro name (after `@call `), not the whole line.
- Macros prefixed with `stdlib:` are ignored (no warning for unknown stdlib references).

**Activation guard:**
- Only runs on documents with `languageId === 'markdownai'`. Plain markdown and other languages are never analyzed.

## Data Flow

Greenfield - no upstream data flow to trace. Input is raw document text; output is `vscode.Diagnostic[]` written into a `DiagnosticCollection` keyed by document URI.

The `MacroRegistry` dependency provides the macro list used in the reference pass. It is already initialized in `extension.ts` before providers register.

## Dependencies

- `55-completion-provider` - provides `MacroRegistry` and `getMacros(document)` for the reference pass.

## Security

Accepts document text as input. The text comes from VS Code's own document model (trusted - written by the user). No sanitization required. No network calls, no file I/O beyond what VS Code provides through its API, no eval.

## Known Issues

(none)
