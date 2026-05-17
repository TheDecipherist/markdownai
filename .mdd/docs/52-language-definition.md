---
id: 52-language-definition
title: VS Code Extension - Language Definition and Detection
edition: Both
depends_on: [51-package-scaffold]
source_files:
  - packages/vscode/package.json
  - packages/vscode/language-configuration.json
  - packages/vscode/src/extension.ts
  - packages/vscode/src/language-detection.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/language-detection.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1.6.6
tags: [vscode, extension, language, detection, markdownai, contributes, grammar]
path: VS Code Extension/Foundation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 52 - VS Code Extension - Language Definition and Detection

## Purpose

Registers the `markdownai` language ID with VS Code and implements content-based language detection. When any `.md` file is opened whose first line is exactly `@markdownai`, the extension switches that document's language to `markdownai`. This makes subsequent features (grammar, snippets, completions) activate correctly.

## Architecture

Two parts:

**Language registration** (`contributes.languages` in package.json + `language-configuration.json`): Defines the `markdownai` language to VS Code. No file extensions are associated - detection is content-based. The language configuration file sets bracket pairs and auto-closing behavior for `{{ }}`.

**Content-based detection** (`src/extension.ts`): The `onDocumentOpened` handler checks `doc.languageId === 'markdown'` and reads line 0. If it is `@markdownai` (trimmed), it calls `vscode.languages.setTextDocumentLanguage(doc, 'markdownai')`. This runs on already-open documents at activation time and on every subsequent open.

## Data Model

None.

## API Endpoints

None.

## Business Rules

- Detection only fires when `doc.languageId === 'markdown'` - avoids re-processing already-switched documents and non-markdown files
- Line 0 is read with `.trim()` - tolerates trailing whitespace
- Match is exact: the trimmed line must equal `@markdownai` (case-sensitive)
- If the document has 0 lines, detection is skipped (no crash)
- `setTextDocumentLanguage` is called but not awaited (fire-and-forget) - failures are non-fatal
- Language ID: `markdownai` (lowercase, no spaces)
- Display names/aliases: `MarkdownAI`, `markdownai`
- The `onStartupFinished` activation event ensures detection runs on all already-open tabs

## Data Flow

Greenfield.

## Dependencies

Depends on 51-package-scaffold (the package structure must exist).

## Security

No untrusted input. Reads `doc.lineAt(0).text` which is VS Code API output - trusted. No file I/O beyond VS Code document API.

## Known Issues

None.
