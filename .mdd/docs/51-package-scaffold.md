---
id: 51-package-scaffold
title: VS Code Extension - Package Scaffold
edition: Both
depends_on: []
source_files:
  - packages/vscode/package.json
  - packages/vscode/tsconfig.json
  - packages/vscode/src/extension.ts
  - packages/vscode/.vscodeignore
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1.6.6
tags: [vscode, extension, scaffold, monorepo, foundation, typescript, package]
path: VS Code Extension/Foundation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 51 - VS Code Extension - Package Scaffold

## Purpose

Creates `packages/vscode/` in the monorepo - a VS Code extension package with the minimum structure needed to compile and load. This is the foundation that all other VS Code extension features (`language-definition`, `syntax-highlighting`, `snippets`) build on top of.

## Architecture

A new npm workspace package at `packages/vscode/`. Uses ESM (`"type": "module"`) consistent with the rest of the monorepo. VS Code 1.85+ supports ESM extensions natively.

```
packages/vscode/
  package.json      -- extension manifest (VS Code format)
  tsconfig.json     -- extends tsconfig.base.json, outputs CommonJS for extension host compat
  .vscodeignore     -- excludes src/ and node_modules/ from VSIX
  src/
    extension.ts    -- activate() + deactivate() entry point
```

The root `workspaces: ["packages/*"]` glob already picks this up - no changes to the root package.json are needed.

**TypeScript target:** The extension host is Node.js-based but has historically required CommonJS. To avoid ESM/CJS interop issues with the vscode runtime module and `@vscode/test-cli`, this package uses `"module": "CommonJS"` in its tsconfig rather than extending the base NodeNext config. The source is still idiomatic TypeScript; only the output format differs.

## Data Model

None.

## API Endpoints

None.

## Business Rules

- The package name is `@markdownai/vscode` and the VS Code display name is `MarkdownAI`
- Minimum VS Code engine version: `^1.85.0`
- `activate()` is exported from `src/extension.ts` - this function will be extended by later features
- `deactivate()` is also exported (may be a no-op for now)
- The package compiles cleanly with `tsc --noEmit` from within `packages/vscode/`
- `activationEvents` is set to `["onStartupFinished"]` for now; `language-definition` will add `onLanguage:markdownai`

## Data Flow

Greenfield - no existing code analyzed.

## Dependencies

None - this is the foundation package.

## Security

None - scaffold only, no input handling or network calls.

## Known Issues

None.
