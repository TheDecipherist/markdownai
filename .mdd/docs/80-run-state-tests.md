---
id: 80-run-state-tests
title: Run-State Tests — All npm Packages
edition: Both
depends_on: [33-e2e-test-suite, 04-cli-core, 51-package-scaffold]
source_files:
  - e2e/run-state.test.ts
routes: []
models: []
test_files:
  - e2e/run-state.test.ts
data_flow: greenfield
last_synced: 2026-05-18
status: complete
phase: all
mdd_version: 1
tags: [testing, npm, run-state, smoke, cli, publish, packages, vitest]
path: Testing/RunState
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 80 — Run-State Tests — All npm Packages

## Purpose

Each npm package in this monorepo must have a run-state test that verifies it
works correctly from its built `dist/` artifacts before it can be published.
These tests catch a class of bug that unit and e2e tests miss: broken relative
paths, missing exports, and binary entry points that fail on a fresh install.
The `prepublishOnly` lifecycle hook in each publishable package blocks `npm publish`
if any run-state test fails.

## Architecture

One test file — `e2e/run-state.test.ts` — covers all five publishable packages.
It runs as part of the existing e2e vitest suite and is the only test that imports
from `dist/` rather than `src/`. The test is organised as five top-level
`describe` blocks, one per package. Each block verifies:

1. The package's main export resolves and returns the expected type
2. The primary function can be called with minimal valid input and does not throw
3. For packages with a CLI binary: the binary exits 0 on `--version` and `--help`
4. At least one real-world operation completes successfully end-to-end

The `prepublishOnly` script in each workspace package's `package.json` runs
`npm --prefix ../.. run test:run-state`, which executes the full suite from the
project root before any `npm publish` is allowed to proceed.

```
npm publish --workspace=packages/parser
  └── prepublishOnly: npm --prefix ../.. run test:run-state
        └── vitest run e2e/run-state.test.ts
              ├── @markdownai/parser  — import parse(), call with fixture
              ├── @markdownai/renderer — import render(), call with AST
              ├── @markdownai/engine   — import execute(), call with fixture
              ├── @markdownai/mcp      — import createServer(), mai-serve --help
              └── @markdownai/core     — mai --version, mai --help, mai render <fixture>
```

## Per-Package Test Specification

### @markdownai/parser
- Import: `import { parse } from 'packages/parser/dist/index.js'`
- Call: `parse('@markdownai v1.0\n\nHello world')`
- Assert: result is an object with a `nodes` array of length >= 1
- Assert: no exception thrown

### @markdownai/renderer
- Import: `import { render } from 'packages/renderer/dist/index.js'`
- Dependency: reuse the parsed AST from the parser test (or parse inline)
- Call: `render(ast, 'markdown')`
- Assert: result is a non-empty string
- Assert: no exception thrown

### @markdownai/engine
- Import: `import { execute } from 'packages/engine/dist/index.js'`
- Call: `execute('@markdownai v1.0\n\n# Test\n\nHello')` with minimal context
- Assert: result contains `'Test'` or `'Hello'`
- Assert: no exception thrown

### @markdownai/mcp
- Import: `import { startServer } from 'packages/mcp/dist/index.js'`
- Assert: `startServer` is a function
- Binary: spawn `packages/mcp/dist/server.js` directly (the `mai-serve` entry point)
- Send: `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`
- Assert: response is valid JSON-RPC 2.0 with `id: 1`
- Note: this test caught that `mai-serve` binary never called `startServer()` --
  fixed 2026-05-18 by adding an ESM entry-point guard in server.ts

### @markdownai/core
- CLI — version: `spawnSync('node', ['packages/core/dist/cli.js', '--version'])`
  - Assert: exit code 0
  - Assert: stdout matches `/\d+\.\d+\.\d+/` (semantic version)
- CLI — help: `spawnSync('node', ['packages/core/dist/cli.js', '--help'])`
  - Assert: exit code 0
  - Assert: stdout contains `'render'`, `'strip'`, `'validate'`
- CLI — render: `spawnSync('node', ['packages/core/dist/cli.js', 'render', fixture])`
  - Fixture: a minimal valid `@markdownai` document written to a temp file
  - Assert: exit code 0
  - Assert: stdout is non-empty

## Business Rules

- All five packages must pass before any single package can be published — the
  suite is all-or-nothing. A failure in `@markdownai/parser` blocks publishing
  `@markdownai/core` too, because the packages depend on each other.
- Tests import from `dist/` only — never from `src/`. This is enforced by the
  file path in the import. If `dist/` does not exist, the import fails and the
  test fails with a clear error.
- `spawnSync` is used for binary tests (not `execSync`) so exit codes are
  available without exception handling.
- The root `package.json` gets a `"test:run-state"` script:
  `"test:run-state": "vitest run e2e/run-state.test.ts"`
- Each publishable package's `package.json` gets:
  `"prepublishOnly": "npm --prefix ../.. run test:run-state"`
- The `@markdownai/markdownai` meta-package is excluded — it has no `main` entry
  or dependencies and is not published independently.
- The `markdownai` VS Code extension is excluded — it is distributed via the
  VS Code Marketplace (not npm) and its `dist/extension.js` requires the VS Code
  runtime, making node-level run-state testing impossible.

## Data Flow

Greenfield — no existing run-state infrastructure. Tests read `dist/` files
produced by `npm run build --workspaces`. No external services involved.

## Dependencies

- `33-e2e-test-suite` — run-state tests live in the same `e2e/` directory and
  use the same vitest config. The `e2e/helpers/` pattern (spawnSync of CLI) is
  the model for binary tests here.
- `04-cli-core` — the `mai` binary entry point (`packages/core/dist/cli.js`) is
  the primary subject of the core package run-state test.
- `51-package-scaffold` — the `files` array in each package's `package.json`
  determines what gets packed. Run-state tests confirm the packed artifacts work.

## Security

Not applicable — run-state tests are local dev-time tooling with no external
input, no network calls, and no credential handling.

## Known Issues

(none)

## Bugs

(none yet — populated by /mdd bug when issues are reported)
