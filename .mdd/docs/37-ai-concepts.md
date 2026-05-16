---
id: 37-ai-concepts
title: AI — @define-concept (Inline Glossary Injection)
edition: Both
depends_on: [01-parser, 03-engine, 34-ai-consumer-mode]
source_files:
  - packages/parser/src/directives/define-concept.ts
  - packages/engine/src/glossary.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/define-concept.test.ts
  - packages/engine/src/__tests__/glossary.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [glossary, concepts, define-concept, ai, domain-terms, vocabulary, calibration]
path: AI/Concepts
wave: markdownai-ai-native-wave-5
wave_status: planned
initiative: markdownai-ai-native
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 37 — AI — @define-concept (Inline Glossary Injection)

## Purpose

`@define-concept` registers domain-specific term definitions inline within a document. At render time, all concepts are collected and rendered as a structured glossary block — injected at the top of the document when `consumer=ai` (so an AI reader encounters definitions before they appear in context), or rendered in-place as a definition list when `consumer=human`. This directly reduces AI hallucination about domain-specific terminology.

## Architecture

```
parser: @define-concept → ConceptNode (name, definition, inline position)
engine: executeDefineConcept()
  → registers into ctx.glossary: Record<string, string>
  → does NOT render at parse site (transparent)
  → after full render: injects glossary block at document top (consumer=ai)
      or renders as in-place definition list (consumer=human or default)
```

The glossary injection happens as a post-walk step — after all nodes have been evaluated — so the complete concept list is known before insertion.

## Data Model

**ConceptNode:**
```typescript
interface ConceptNode extends ASTNode {
  type: 'define-concept'
  name: string         // term being defined
  definition: string   // single-line or multi-line definition
}
```

**Grammar (two forms):**
```
@define-concept jailRoot "the document root directory used to confine file access"

@define-concept strict-mode
When --strict is active, any warning becomes a fatal error that halts rendering.
@end
```

Single-line form: term and definition on one line.
Block form: term on directive line, definition in body up to `@end`.

**Runtime glossary:**
```typescript
// In EngineContext:
glossary: Map<string, string>   // name → definition, insertion-ordered
```

## Business Rules

**Rendering behavior by consumer:**

*`consumer="ai"` — glossary injected at document top:*
```markdown
## Glossary

**jailRoot** — the document root directory used to confine file access
**strict-mode** — when --strict is active, any warning becomes a fatal error

---
```

*`consumer="human"` or not set — rendered as in-place definition list:*
Each `@define-concept` renders at its location in the document as:
```markdown
**jailRoot** — the document root directory used to confine file access
```

**Duplicate concept names:** last definition wins — no error, WARN logged.

**Concept ordering in AI glossary:** insertion order (document order) — concepts appear in the glossary in the order they were defined.

**`@define-concept` inside `@define`/`@call`:** the concept is registered when the macro is called, not when it is defined. The glossary injection point (top of document) is always at the end of the full walk, so call order doesn't matter.

**Stripper behavior:** `mai strip` removes `@define-concept` directives. The glossary block is not injected when stripping.

**Validate behavior:** `mai validate` reports all `@define-concept` directives as valid — no undefined-concept errors.

**Accessing a concept in interpolation:** `{{ concept.jailRoot }}` — if `jailRoot` is defined via `@define-concept`, it is accessible in the interpolation context. This allows concepts to be reused inline without repeating the definition.

## Data Flow

Greenfield. No existing data flows modified. The glossary is a new field on EngineContext.

## Dependencies

- **01-parser** — new directive module `define-concept.ts` registered in the directive registry.
- **03-engine** — `glossary.ts` provides the concept registry and post-walk injection logic.
- **34-ai-consumer-mode** — `ctx.consumer` controls whether glossary is injected at top (ai) or in-place (human).

## Security

`@define-concept` content is author-controlled document text. No execution, no file reads, no network calls. The concept definition is a plain string rendered as markdown prose — not evaluated.

## Known Issues

(none)
