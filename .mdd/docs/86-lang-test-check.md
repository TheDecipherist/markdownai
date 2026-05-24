---
id: 86-lang-test-check
title: Language — @test and @check Directives (Code Quality)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 24-security-shell]
relates: [04-cli-core, 87-lang-hash]
source_files:
  - packages/parser/src/directives/test.ts
  - packages/parser/src/directives/check.ts
  - packages/engine/src/exec-ops.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/test-check.test.ts
data_flow: reads-existing
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [test, check, quality, typecheck, lint, directive, language, shell]
path: Language/Quality
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/exec-ops.ts
known_issues: []
---

# 86 — Language — @test and @check Directives

## Purpose

`@test` and `@check` run code quality commands directly from a MarkdownAI
document and embed the results inline. `@test` runs a project's test suite;
`@check` runs type-checking, linting, or formatting tools. Both auto-detect
the right command from `package.json` scripts if none is specified.

These directives enable living documentation that proves its own claims - a
doc can assert "tests pass" and run them on render.

## Architecture

**Parser — `packages/parser/src/directives/test.ts`**

Parses the inline directive and returns a `TestNode` with:
- `command?: string` - explicit command (optional; auto-detected if absent)
- `label?: string` - variable name for result storage
- `budget?: number` - execution timeout

**Parser — `packages/parser/src/directives/check.ts`**

Parses the inline directive and returns a `CheckNode` with:
- `command?: string` - explicit command (optional; auto-detected if absent)
- `label?: string` - variable name for result storage
- `budget?: number` - execution timeout

**Engine — `packages/engine/src/exec-ops.ts`**

Both directives share the same execution path:

`executeTest(node, ctx)` / `executeCheck(node, ctx)`:
1. Security gate check (shell execution must be permitted for the CWD)
2. Command resolution:
   - `@test`: uses `node.command` if set; otherwise reads `package.json scripts.test`; falls back to `npm test`
   - `@check`: uses `node.command` if set; otherwise tries `scripts.typecheck`, then `scripts.check`, then `scripts.lint`, then `scripts.build`
3. Spawns the command as a child process with `ctx.cwd` as working directory
4. Output parsing: recognizes vitest/jest/playwright/node-test output for clean summaries; falls back to tail-N lines for unknown runners (eslint, prettier, tsc)
5. If `label` set: stores parsed result in `ctx.envFiles[label]`; otherwise returns inline

## Data Model

No persistence. Both are AST nodes only.

```typescript
interface TestNode extends ASTNodeBase {
  type: 'test'
  command?: string
  label?: string
  budget?: number
}

interface CheckNode extends ASTNodeBase {
  type: 'check'
  command?: string
  label?: string
  budget?: number
}
```

## API Endpoints

None. Language directives only.

## Business Rules

**@test syntax:**
```
@test

@test command="npm run test:unit"

@test label=testResults budget=60
```

**@check syntax:**
```
@check

@check command="npx tsc --noEmit"

@check label=lintResult
```

**Auto-detection for @test:**
1. Read `package.json` → look for `scripts.test`
2. Fall back to `npm test`

**Auto-detection for @check (tried in order):**
1. `scripts.typecheck`
2. `scripts.check`
3. `scripts.lint`
4. `scripts.build`
5. Fall back to `npx tsc --noEmit`

**Output recognition:**
- vitest: matches `✓` / `×` summary lines
- jest: matches `PASS` / `FAIL` and test count lines
- playwright: matches test result table
- node:test: matches `▶` pass/fail tree
- tsc: all output preserved (errors visible)
- eslint/prettier: last N lines preserved
- Unknown runner: last 20 lines of output

**Security gate:**
Shell execution must be permitted by the security config for the current working
directory. If shell execution is disabled, both directives fail with a clear
security error rather than spawning silently.

**`budget` argument:**
Maximum execution time in seconds before the process is killed. Defaults to the
engine's default shell timeout. Exceeded budget results in a timeout error embedded
in the output rather than a fatal document error.

## Data Flow

Inline directive parsed → `TestNode`/`CheckNode`. At execution: security check
→ command resolution → child process spawn → output parsing → result stored or
inlined.

## Dependencies

- `01-parser`: node types in the `ASTNode` union
- `03-engine`: execution wired into `walkNode` switch via exec-ops.ts
- `24-security-shell`: shell permission check before spawning any command

## Security

Both directives go through the shell security gate before spawning. If the
CWD is not in the shell allowlist, the directive errors. Explicit commands are
not further sanitized beyond what the shell security layer enforces.

## Known Issues

(none yet)
