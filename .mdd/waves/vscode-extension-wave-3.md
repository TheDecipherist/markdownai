---
id: vscode-extension-wave-3
title: "Wave 3: Tests + Polish"
initiative: vscode-extension
initiative_version: 1
status: complete
depends_on: vscode-extension-wave-2
demo_state: "npm test runs green in packages/vscode. An unclosed @if shows a red squiggly. README documents every feature with examples."
created: 2026-05-17
hash:
---

# Wave 3: Tests + Polish

## Demo-State

`npm test` in `packages/vscode` completes with all tests passing. Open a document with `@if` missing its `@endif` and a red squiggly appears under the `@if` with message "Unclosed @if block". Open a document with `@call undefined-macro` and a yellow warning appears. The project README has a VS Code Extension section with feature descriptions and animated examples.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | diagnostics-provider | .mdd/docs/59-diagnostics-provider.md | active | - |
| 2 | test-suite | .mdd/docs/61-test-suite.md | active | diagnostics-provider |
| 3 | extension-settings | .mdd/docs/60-extension-settings.md | active | - |
| 4 | readme-and-marketplace | .mdd/docs/62-readme-and-marketplace.md | active | test-suite |

## Open Research

- Test framework: `@vscode/test-cli` is the current standard (replaced the older `@vscode/test-electron` pattern). Uses Mocha under the hood. Tests run in a VS Code instance with the extension loaded.
- Diagnostics implementation: VS Code `DiagnosticCollection` updated on every document change via `vscode.workspace.onDidChangeTextDocument`. Parser already handles structural validation - wire it up to emit VS Code diagnostics rather than warnings array.
- Marketplace publishing: `vsce` (Visual Studio Code Extensions CLI) packages and publishes to the VS Code Marketplace. Requires a publisher account. This wave covers README and metadata - actual marketplace publish is a separate ops runbook.
