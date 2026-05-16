---
id: 38-ai-constraints
title: AI — @constraint Directive (Machine-Readable Rules)
edition: Both
depends_on: [01-parser, 03-engine, 34-ai-consumer-mode]
source_files:
  - packages/parser/src/directives/constraint.ts
  - packages/engine/src/constraints.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/constraint.test.ts
  - packages/engine/src/__tests__/constraints.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [constraints, rules, machine-readable, ai, enforcement, documentation, compliance]
path: AI/Constraints
wave: markdownai-ai-native-wave-5
wave_status: planned
initiative: markdownai-ai-native
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 38 — AI — @constraint Directive (Machine-Readable Rules)

## Purpose

`@constraint` embeds machine-readable rules directly inside a document. Rules are authored in prose but tagged with a stable `id` and `severity` so AI tools can parse and enforce them programmatically. At render time, all constraints are collected and rendered as a structured block. This bridges the gap between "rules written in prose that AI might ignore" and "rules explicitly marked as constraints that AI tools can parse, quote, and verify against generated code."

## Architecture

```
parser: @constraint → ConstraintNode (id, severity, body)
engine: executeConstraint()
  → registers into ctx.constraints[]
  → renders nothing at directive site
  → after full render: injects constraints block at document top (consumer=ai)
      or renders as in-place labeled rule (consumer=human or default)
```

## Data Model

**ConstraintNode:**
```typescript
interface ConstraintNode extends ASTNode {
  type: 'constraint'
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  body: string
}
```

**Grammar:**
```
@constraint id="no-raw-sql" severity="critical"
NEVER pass user input directly to a database query. Always use parameterized queries.
@end

@constraint id="eval-forbidden" severity="critical"
eval() is never used. Use vm.runInNewContext() for expression evaluation.
@end
```

`id` is required — a stable slug for programmatic reference.
`severity` defaults to `"high"` if not specified.

**Runtime constraint registry:**
```typescript
// In EngineContext:
constraints: Array<{ id: string; severity: string; body: string }>
```

## Business Rules

**Severity levels:**
- `critical` — must never be violated; AI tools should treat as absolute prohibition
- `high` — strong rule; violations indicate likely bugs or security issues
- `medium` — design preference; violations are noteworthy
- `low` — style or convention

**Rendering by consumer:**

*`consumer="ai"` — constraints block injected at document top:*
```markdown
## Constraints

| ID | Severity | Rule |
|----|----------|------|
| no-raw-sql | CRITICAL | NEVER pass user input directly to a database query. Always use parameterized queries. |
| eval-forbidden | CRITICAL | eval() is never used. Use vm.runInNewContext() for expression evaluation. |

---
```

*`consumer="human"` or not set — rendered in-place as labeled rules:*
```markdown
> ⚠️ **CONSTRAINT [no-raw-sql] — CRITICAL**
> NEVER pass user input directly to a database query. Always use parameterized queries.
```

**Ordering:** constraints are rendered in severity order (critical first), then insertion order within the same severity.

**Duplicate ids:** second definition overwrites the first — WARN logged.

**`@constraint` inside `@define`/`@call`:** constraint is registered when the macro is called. Injection point is always end-of-walk, so order doesn't matter.

**`mai validate` output:** lists all `@constraint` ids found in the document with their severity — provides a quick overview of the document's rule set without rendering.

**MCP tool `get_constraints`:** a new MCP tool that returns the constraint registry as structured JSON from a rendered document. Designed for AI coding assistants that want to enforce document rules when generating code.

**Stripper behavior:** `mai strip` removes `@constraint` blocks.

## Data Flow

Greenfield. No existing data flows modified. The constraint registry is a new field on EngineContext.

## Dependencies

- **01-parser** — new directive module `constraint.ts` registered in the directive registry.
- **03-engine** — `constraints.ts` provides registry and post-walk injection logic.
- **34-ai-consumer-mode** — `ctx.consumer` controls rendering format.

## Security

`@constraint` content is author-controlled document text. No execution, no file reads, no network calls. The constraint body is rendered as markdown prose — not evaluated. The MCP `get_constraints` tool returns read-only structured data — no write surface.

## Known Issues

(none)
