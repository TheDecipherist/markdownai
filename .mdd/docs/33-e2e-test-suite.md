---
id: 33-e2e-test-suite
title: E2E Test Suite — Fixture Files and CLI Verification
edition: Both
depends_on: [04-cli-core, 10-lang-include, 11-lang-import, 08-lang-macros, 12-lang-conditionals, 13-lang-pipeline, 14-lang-sources-list, 15-lang-sources-read, 16-lang-sources-utilities, 07-lang-env, 21-lang-phases, 28-caching, 29-stripper, 32-cli-complete]
source_files:
  - e2e/e2e.test.ts
  - e2e/vitest.config.ts
  - mai/01-docs-hub.md
  - mai/02-project-report.md
  - mai/03-api-reference.md
  - mai/04-config-showcase.md
  - mai/shared/macros.md
  - mai/sections/intro.md
  - mai/sections/guide.md
  - mai/data/config.json
  - mai/data/features.json
  - mai/data/team.csv
routes: []
models: []
test_files:
  - e2e/e2e.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: complete
phase: all
mdd_version: 1
tags: [e2e, testing, fixtures, cli, directives, integration, vitest, scenarios]
path: Testing/E2E
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 33 — E2E Test Suite — Fixture Files and CLI Verification

## Purpose

Creates a realistic `./mai/` folder of MarkdownAI fixture documents that demonstrate every
safe directive in real-world scenarios, paired with an `e2e/e2e.test.ts` test file that runs
the full CLI pipeline and asserts correct markdown output. This proves the CLI works
end-to-end — from `.md` source through parser → engine → renderer → valid markdown output.

## Architecture

```
./mai/                        ← fixture documents (real markdownai content)
  01-docs-hub.md              ← @include, @define/@call, @if, {{ interpolation }}
  02-project-report.md        ← @list, @tree, @count, @date, @env
  03-api-reference.md         ← @import, @phase, pipe | @render
  04-config-showcase.md       ← @read JSON/CSV, conditional sections
  shared/
    macros.md                 ← @define macro library (imported, not rendered directly)
  sections/
    intro.md                  ← included by docs-hub
    guide.md                  ← included by docs-hub
  data/
    config.json               ← JSON data for @read tests
    features.json             ← JSON array for @list path= tests
    team.csv                  ← CSV for @read columns= tests

e2e/
  vitest.config.ts            ← vitest config scoped to e2e/
  e2e.test.ts                 ← test file
```

The test file imports `runRender`, `runStrip`, and `runValidate` from `@markdownai/core`
directly (same pattern as `packages/core/src/__tests__/cli.test.ts`). One test group also
spawns the `mai` binary via `spawnSync` to verify the CLI entry point works independently
of the Node import path.

## Data Model

No database. Fixture files are static markdown sources. JSON/CSV data files exist at:
- `mai/data/config.json` — `{ project, version, env, features: [] }`
- `mai/data/features.json` — `[ { name, status, priority } ]`
- `mai/data/team.csv` — `name,role,joined` rows

## API Endpoints

None — this is a tooling feature.

## Business Rules

### Fixture rules
- Every fixture must start with `@markdownai` header
- Fixtures use ONLY safe directives (no @http, @db, @query, @connect)
- All `@include` and `@read` paths are relative to the fixture file's directory
- `mai/shared/macros.md` is never rendered directly — only @imported by other fixtures
- Fixture files reference each other to test cross-file resolution:
  - `01-docs-hub.md` @includes `sections/intro.md` and `sections/guide.md`
  - `03-api-reference.md` @imports `shared/macros.md`
  - `04-config-showcase.md` @reads `data/config.json` and `data/team.csv`

### Test rules
- Every fixture must render with `exitCode === 0`
- Rendered output must not contain any unresolved directive tokens (`@include`, `@define`, `@call`, `@if`, `@phase`, `@end`, `@list`, `@tree`, `@read`, `@count`, `@date`, `@env`, `@render`)
- Rendered output must be non-empty
- Rendered output must preserve non-directive prose content
- `runStrip()` on each fixture must produce output with no `@` directives
- `runValidate()` on each fixture must return `valid: true`

### CLI binary smoke test
- Spawning `node packages/core/dist/cli.js render <fixture>` must exit with code 0
- The binary smoke test verifies the shebang + Commander wiring, not just the JS API

### Cache test
- A fixture with `@cache mode="session"` must render identically on second call
- Cache invalidation via `runCache('--clear')` must not error

### Error-case tests
- A fixture with a circular @include must produce an error containing "circular"
- A fixture with a missing @include target must produce an error with exitCode 1
- A fixture with a relative path traversal (`../../etc/passwd`) must produce a security error

## Data Flow

Greenfield — no existing code modified. The test file calls:
```
runRender(fixturePath) → { output, errors, warnings, exitCode }
runStrip(fixturePath)  → { output, errors, warnings, exitCode }
runValidate(fixturePath) → { valid, errors }
spawnSync('node', ['packages/core/dist/cli.js', 'render', fixturePath])
```

## Dependencies

- 04-cli-core: provides `runRender`, `runStrip`, `runValidate`, `runCache`
- 10-lang-include: tested by docs-hub fixture
- 11-lang-import: tested by api-reference fixture
- 08-lang-macros: `@define`/`@call` tested by docs-hub and api-reference
- 12-lang-conditionals: `@if` tested by docs-hub and config-showcase
- 13-lang-pipeline: pipe + `@render` tested by project-report
- 14-lang-sources-list: `@list` tested by project-report
- 15-lang-sources-read: `@read` tested by config-showcase
- 16-lang-sources-utilities: `@tree`, `@date`, `@count` tested by project-report
- 07-lang-env: `@env` tested by docs-hub (fallback) and project-report
- 21-lang-phases: `@phase` tested by api-reference
- 28-caching: `@cache` modifier tested in cache test group
- 29-stripper: `runStrip` tested against all fixtures
- 32-cli-complete: validate, cache commands tested

## Security

No external input accepted. All fixture paths are hardcoded strings relative to project root.
The error-case tests verify that path traversal attempts are rejected by the engine's
jailRoot confinement — testing the security enforcement is correct behaviour.

## Known Issues

(none — new feature)
