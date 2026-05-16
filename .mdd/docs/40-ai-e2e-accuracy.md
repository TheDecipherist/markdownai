---
id: 40-ai-e2e-accuracy
title: AI — E2E Accuracy Tests and Format Benchmarks
edition: Both
depends_on: [33-e2e-test-suite, 34-ai-consumer-mode, 35-ai-prompt, 36-ai-context-budget, 37-ai-concepts, 38-ai-constraints, 39-ai-format]
source_files:
  - e2e/e2e-ai.test.ts
  - e2e/ai-fixtures/01-consumer-targeting.md
  - e2e/ai-fixtures/02-prompt-instructions.md
  - e2e/ai-fixtures/03-context-budget.md
  - e2e/ai-fixtures/04-concepts-and-constraints.md
  - e2e/ai-fixtures/05-format-benchmark.md
  - e2e/ai-fixtures/sections/intro.md
routes: []
models: []
test_files:
  - e2e/e2e-ai.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [e2e, ai, testing, benchmarks, accuracy, token-savings, format, consumer, rendered-ai]
path: Testing/AI-E2E
wave: markdownai-ai-native-wave-6
wave_status: planned
initiative: markdownai-ai-native
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 40 — AI — E2E Accuracy Tests and Format Benchmarks

## Purpose

End-to-end tests covering all six AI-native features from Wave 5. Two concerns are tested together: **accuracy** (ai-format output preserves all information, consumer-targeted branches render correctly, directives produce expected output) and **savings** (token counts before/after `--format=ai` are measured and written to a human-readable benchmark report). Rendered ai-format outputs are written to `e2e/rendered-ai/` alongside the existing `e2e/rendered/` so developers can visually diff them.

## Architecture

```
e2e/
  e2e-ai.test.ts          — vitest test file, all AI-native assertions
  ai-fixtures/            — 5 fixture .md files exercising the AI features
    01-consumer-targeting.md
    02-prompt-instructions.md
    03-context-budget.md
    04-concepts-and-constraints.md
    05-format-benchmark.md
    sections/intro.md     — shared include for fixtures
  rendered-ai/            — written by tests (gitignored); ai-format rendered outputs
  benchmarks/             — written by tests (gitignored)
    ai-format-report.md   — human-readable savings report, generated per run
```

The existing `e2e/e2e.test.ts` (33-e2e-test-suite) is not modified. `e2e-ai.test.ts` is a parallel test file in the same workspace.

## Business Rules

### Accuracy Tests

**Consumer mode (`01-consumer-targeting.md`):**
- Fixture contains `@if consumer="ai"` blocks and `@if consumer="human"` blocks with distinguishable content
- `runRender(file, { consumer: 'ai' })` → ai blocks visible, human blocks hidden
- `runRender(file, { consumer: 'human' })` → human blocks visible, ai blocks hidden
- `runRender(file, {})` (no consumer) → all `@if consumer=` blocks evaluate to false; `@else` content visible
- Output contains no unresolved `@if`/`@endif` tokens

**`@prompt` directive (`02-prompt-instructions.md`):**
- Fixture contains `@prompt role="context"` and `@prompt role="constraint"` blocks
- Consumer=ai → prompt blocks render with `[AI INSTRUCTION — context]` prefix format
- Consumer=human → prompt blocks render as blockquote callouts
- Both renders contain the prompt body text (never hidden entirely)
- `mai strip` output contains no `@prompt` tokens

**Context budget + section priority (`03-context-budget.md`):**
- Fixture contains `@section priority="critical"`, `@section priority="high"`, `@section priority="low"` blocks and `@chunk-boundary id=` markers
- No `--budget`: all sections render, chunk-boundary markers appear as HTML comments
- `--budget=<N>` where N is less than full document: low-priority sections are dropped, critical sections always present
- `--chunk-map`: chunk-boundary JSON sidecar is emitted
- Critical sections: never absent regardless of budget value

**`@define-concept` + `@constraint` (`04-concepts-and-constraints.md`):**
- Fixture defines 3 concepts and 2 constraints
- Consumer=ai → glossary block at document top before any content; constraints table at top; all concepts and constraints accounted for
- Consumer=human → concepts render in-place as definition entries; constraints render as callout blockquotes
- `mai validate` output lists all constraint ids found

**`--format=ai` accuracy (`05-format-benchmark.md`):**
- Fixture is a rich document with: horizontal rules, bold headers, excessive blank lines, GFM tables, code blocks, links, blockquotes, lists
- `aiFilter(standard)` output passes accuracy checks:
  - All headings present (count matches)
  - All code blocks present (count matches)
  - All table rows present (GFM tables preserved)
  - All links present (count matches)
  - No `---` horizontal rules remain
  - No more than 2 consecutive blank lines
- **Idempotency:** `aiFilter(aiFilter(output)) === aiFilter(output)` asserted explicitly

### Benchmark Report

After all render tests pass, a benchmark pass runs for every fixture:

1. Render each fixture in standard format → count characters → estimate tokens (`ceil(chars / 4)`)
2. Apply `aiFilter()` → count characters → estimate tokens
3. Compute: `savings = standardTokens - aiTokens`, `pct = Math.round((savings / standardTokens) * 100)`

Write `e2e/benchmarks/ai-format-report.md`:

```markdown
# AI Format Benchmark Report
Generated: <ISO date>

## Token Savings Summary

| Fixture | Standard (est. tokens) | AI Format (est. tokens) | Saved | % |
|---------|----------------------|------------------------|-------|---|
| 01-consumer-targeting | N | N | N | N% |
| 02-prompt-instructions | N | N | N | N% |
| 03-context-budget | N | N | N | N% |
| 04-concepts-and-constraints | N | N | N | N% |
| 05-format-benchmark | N | N | N | N% |
| **Total** | **N** | **N** | **N** | **N%** |

## Notes
- Token estimate: ceil(characters / 4)
- AI format removes: horizontal rules, excess blank lines, decorative bold labels
- AI format preserves: headings, code blocks, tables, links, lists, blockquotes
```

### Rendered AI Output Files

After each render test, if `exitCode === 0`, write to `e2e/rendered-ai/<fixture-name>.md`. These are human-inspectable — a developer opens them beside `e2e/rendered/<fixture-name>.md` to confirm no information was lost. Both directories are gitignored (regenerated on every test run).

### `noRawAiDirectives()` helper

Extends the existing `noRawDirectives()` check with new AI directive tokens:
```typescript
const aiDirectiveTokens = ['@prompt ', '@define-concept ', '@constraint ', '@section ', '@chunk-boundary ']
```

All AI-format outputs must pass both `noRawDirectives()` and `noRawAiDirectives()`.

## Data Flow

Greenfield. `e2e-ai.test.ts` imports from `@markdownai/core` and `@markdownai/renderer` — same import surface as `e2e.test.ts`. No new infrastructure needed.

## Dependencies

- **33-e2e-test-suite** — this feature follows the same patterns (fixture folder, `noRawDirectives`, `saveRendered`, vitest). Does not modify `e2e.test.ts`.
- **34-ai-consumer-mode** through **39-ai-format** — all six Wave 5 features must be complete before this wave begins.

## Security

Test-only code. No production security concerns.

## Known Issues

(none)
