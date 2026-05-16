---
id: 44-mcp-e2e-ai-integration
title: MCP E2E — AI-Native Integration and Realistic Claude Workflow
edition: Both
depends_on: [30-mcp-server, 39-ai-format, 38-ai-constraints, 43-mcp-e2e-security]
source_files:
  - e2e/mcp-fixtures/ai-native.md
  - e2e/e2e-mcp-ai.test.ts
routes: []
models: []
test_files:
  - e2e/e2e-mcp-ai.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [mcp, e2e, ai, format, consumer, get-constraints, workflow, claude, realistic, token-efficient]
path: Testing/MCP-E2E
wave: markdownai-mcp-e2e-wave-2
wave_status: planned
initiative: markdownai-mcp-e2e
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 44 — MCP E2E — AI-Native Integration and Realistic Claude Workflow

## Purpose

Verifies AI-native features work correctly through the MCP interface as Claude would experience them: `read_file` returns ai-format output by default (no format flag needed), `get_constraints` returns the constraint registry from a document using `@constraint`, `@prompt` blocks render in AI format in MCP responses, and a realistic multi-turn Claude session — the kind that runs when Claude Code opens a MarkdownAI project — completes end-to-end without error.

## Architecture

```
e2e/e2e-mcp-ai.test.ts
  imports: { spawnMcpServer, rpcCall } from './helpers/mcp-helpers.js'

e2e/mcp-fixtures/ai-native.md
  A MarkdownAI document using all AI-native features:
    @prompt, @define-concept, @constraint, @section priority=, @chunk-boundary
    Multiple phases for realistic workflow test
```

## Data Model

### Fixture: `ai-native.md`

```markdown
@markdownai

@prompt role="context"
This document describes the MarkdownAI rendering pipeline.
All file paths are relative to the document root (jailRoot).
@end

@define-concept jailRoot "the document root directory, used to confine @include and @read paths"
@define-concept strictMode "when --strict is active, any warning becomes a fatal error"

@constraint id="no-eval" severity="critical"
eval() is never used. Use vm.runInNewContext() for all expression evaluation.
@end

@constraint id="no-traversal" severity="critical"
File paths must never escape the jailRoot. ../  sequences are always blocked.
@end

@section priority="critical"
## Core Architecture
The parser produces an AST. The engine walks it.
@end

@section priority="low"
## Historical Background
MarkdownAI was created in 2026.
@end

@chunk-boundary id="core" standalone="true"

@phase implementation
## Implementation Phase
Key implementation details.
@on complete -> review
@end

@phase review
## Review Phase
Final review criteria.
@end
```

## Business Rules

### `read_file` Returns AI Format by Default

- `read_file({ path: "ai-native.md" })` → result does NOT contain raw `---` horizontal rules
- Result contains `[AI INSTRUCTION — context]` prefix (the `@prompt` block in ai format)
- Consecutive blank lines collapsed
- No unresolved directive tokens
- Token count of result is measurably less than standard format (assert `result.length < standardLength`)

### `read_file` Can Be Overridden to Standard Format

- `read_file({ path: "ai-native.md", format: "standard" })` → returns standard markdown (not filtered)
- Standard result is longer than ai-format result

### `get_constraints` Tool

- `get_constraints({ file: "ai-native.md" })` → returns array with 2 constraints
- `no-eval` entry: `{ id: "no-eval", severity: "critical", body: "eval() is never used..." }`
- `no-traversal` entry: severity `"critical"`, body present
- Order: critical first (severity sort)
- Non-MarkdownAI file → empty array, exitCode 0
- File with no `@constraint` blocks → empty array, exitCode 0

### `@prompt` in MCP Response

- `read_file` result contains `[AI INSTRUCTION — context]` wrapper (ai format for @prompt)
- Body text `"This document describes the MarkdownAI rendering pipeline"` is present
- Result does NOT contain raw `@prompt` or `@end` tokens

### `@define-concept` in MCP Response

- When consumer is ai (default in MCP), the glossary block appears at the top of the rendered content
- `jailRoot` and `strictMode` definitions are present in the result
- They appear before the `## Core Architecture` heading

### Context Budget via MCP — `read_file` with Budget

- `read_file({ path: "ai-native.md", budget: 50 })` → low-priority section (`@section priority="low"`) is absent
- Critical section (`@section priority="critical"`) is always present regardless of budget
- Very low budget (budget: 1) → only critical sections, no low/medium sections

### Realistic Multi-Turn Claude Workflow

Simulates a complete Claude Code session with a MarkdownAI project:

```
Step 1: initialize
Step 2: tools/list → verify get_constraints is in the tool list
Step 3: read_file("ai-native.md")
  → ai-format rendered output, @prompt visible, glossary at top, constraints table at top
Step 4: get_constraints("ai-native.md")
  → [{ id: "no-eval", severity: "critical", ... }, { id: "no-traversal", ... }]
Step 5: list_phases("ai-native.md")
  → [{ name: "implementation", transitions: ["review"] }, { name: "review", transitions: [] }]
Step 6: resolve_phase("ai-native.md", "implementation")
  → rendered implementation phase content, ai-format
Step 7: next_phase("ai-native.md", "implementation")
  → "review"
Step 8: resolve_phase("ai-native.md", "review")
  → rendered review phase content, ai-format
Step 9: next_phase("ai-native.md", "review")
  → null
Step 10: invalidate_cache({ file: "ai-native.md" })
  → { cleared: true }
```

All 10 steps complete without error. At each step, responses are well-formed JSON-RPC with `result` (not `error`). Phase content at steps 6 and 8 is in ai-format (shorter than standard, no decorative rules).

## Data Flow

Greenfield. Depends on Wave 5 AI-native features being implemented before this test can pass (the `@prompt`, `@constraint`, `@define-concept` directives must exist in the engine and parser).

## Dependencies

- **30-mcp-server** — the server under test.
- **39-ai-format** — `aiFilter()` used by default in MCP responses; `read_file` format override.
- **38-ai-constraints** — `get_constraints` tool tested here.
- **43-mcp-e2e-security** — shares subprocess helpers; this test runs after security is confirmed.

## Security

Test-only. The `read_file` format override test (`format: "standard"`) is not a security test — it verifies the default can be overridden by an authorized caller, not bypassed by an attacker. Attacker-focused tests are in `43-mcp-e2e-security`.

## Known Issues

(none)
