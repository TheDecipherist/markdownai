---
id: 61-test-suite
title: Extension Test Suite
edition: VS Code Extension
depends_on: [59-diagnostics-provider, 60-extension-settings]
source_files:
  - packages/vscode/vitest.config.ts
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/completion-provider.test.ts
  - packages/vscode/src/__tests__/definition-provider.test.ts
  - packages/vscode/src/__tests__/diagnostics-provider.test.ts
  - packages/vscode/src/__tests__/grammar.test.ts
  - packages/vscode/src/__tests__/hover-provider.test.ts
  - packages/vscode/src/__tests__/language-detection.test.ts
  - packages/vscode/src/__tests__/reference-provider.test.ts
  - packages/vscode/src/__tests__/settings.test.ts
  - packages/vscode/src/__tests__/snippets.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: v1.6.6
initiative: vscode-extension
wave: vscode-extension-wave-3
wave_status: active
tags: [testing, vitest, vscode, extension, ci, coverage]
path: VS Code Extension/Quality
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 61 - Extension Test Suite

## Purpose

Defines the test infrastructure for `packages/vscode` and verifies that all 9 test files run green via `npm test`. Uses vitest with a pure-function testing strategy that avoids VS Code API mocking.

## Architecture

**Test strategy: pure function extraction.** VS Code API wiring lives in provider files that import `vscode` - these are not directly tested. Pure analysis logic is extracted into separate modules (e.g., `macro-registry.ts`, `diagnostics-engine.ts`, `settings.ts`) that have no VS Code imports and are fully testable with vitest.

```
packages/vscode/
  vitest.config.ts          - explicit test config with globals and test file pattern
  src/__tests__/
    completion-provider.test.ts   - 15 tests: macro-registry parsing functions
    definition-provider.test.ts   - 3 tests: extractCallTarget
    diagnostics-provider.test.ts  - 18 tests: analyzeDiagnostics structural + warning logic
    grammar.test.ts               - 6 tests: TextMate grammar token scopes
    hover-provider.test.ts        - 12 tests: extractCallTarget, formatHoverMarkdown
    language-detection.test.ts    - 7 tests: shouldSwitchToMarkdownAI
    reference-provider.test.ts    - 6 tests: findCallSites
    settings.test.ts              - 5 tests: readSettings defaults and overrides
    snippets.test.ts              - 7 tests: snippet body content
```

**Why vitest over @vscode/test-cli:** `@vscode/test-cli` runs tests inside a VS Code instance, which requires a display server, takes 5-10s to start, and is complex to configure in CI. Since all testable logic is in pure functions, vitest runs in < 1s with no external dependencies.

## Data Model

No storage.

## API Endpoints

None.

## Business Rules

- `npm test` in `packages/vscode` must complete with 0 failures.
- Test files live in `src/__tests__/` and follow `*.test.ts` naming.
- Tests import only from pure function modules - never from modules that import `vscode`.
- Each test file covers one concern (one provider or module).

## Data Flow

Greenfield.

## Dependencies

- `59-diagnostics-provider` - test file `diagnostics-provider.test.ts` tests `analyzeDiagnostics` from `diagnostics-engine.ts`
- `60-extension-settings` - test file `settings.test.ts` tests `readSettings` from `settings.ts`

## Security

No security surface. Test infrastructure only.

## Known Issues

(none)
