---
id: 36-ai-context-budget
title: AI — Context Budget, Section Priority, and Chunk Boundaries
edition: Both
depends_on: [01-parser, 03-engine, 04-cli-core]
source_files:
  - packages/parser/src/directives/section.ts
  - packages/parser/src/directives/chunk-boundary.ts
  - packages/core/src/commands/render.ts
  - packages/core/src/commands/build.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/section.test.ts
  - packages/engine/src/__tests__/budget.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [budget, context-window, priority, section, chunk-boundary, rag, token-limit, ai]
path: AI/ContextBudget
wave: markdownai-ai-native-wave-5
wave_status: planned
initiative: markdownai-ai-native
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 36 — AI — Context Budget, Section Priority, and Chunk Boundaries

## Purpose

Three closely related directives that give document authors control over how their content behaves under AI context window constraints. `@section priority=` marks the relative importance of content blocks. `@chunk-boundary` declares where RAG systems should split the document. `--budget tokens=N` on the render command enforces the budget — truncating low-priority sections when the token limit is approached.

## Architecture

```
parser:
  @section priority="critical" → SectionNode wrapping content until @end
  @chunk-boundary id="X"       → ChunkBoundaryNode (inline marker, no body)

engine:
  walk collects SectionNodes with priority + estimated token cost
  budget.ts: if --budget passed → budget pass after full render
    → sort sections by priority, drop from lowest until total <= budget
    → never drop "critical" sections

render command:
  --budget <N>  → passed to engine budget pass (tokens, not bytes)
  --chunk-map   → emit chunk-boundary map as JSON alongside output
```

## Data Model

**SectionNode:**
```typescript
interface SectionNode extends ASTNode {
  type: 'section'
  id?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  children: ASTNode[]
}
```

**ChunkBoundaryNode:**
```typescript
interface ChunkBoundaryNode extends ASTNode {
  type: 'chunk-boundary'
  id: string
  standalone: boolean   // true = this chunk makes sense without surrounding context
}
```

**Grammar:**
```
@section [id="<id>"] priority="<priority>"
<content — may contain any directives>
@end

@chunk-boundary id="<id>" [standalone="true"]
```

## Business Rules

**Priority levels (in order, critical = never dropped):**
- `critical` — never dropped, regardless of budget
- `high` — dropped only after all `low` and `medium` sections are gone
- `medium` — default if `priority` not specified
- `low` — dropped first when budget is tight

**Budget calculation:**
- Token estimate = `Math.ceil(characterCount / 4)` — industry standard approximation
- Budget pass runs AFTER full render (all directives resolved, all includes expanded)
- Sections are whole units — never truncated mid-section, only entirely dropped
- Non-section content (not wrapped in `@section`) is treated as `priority: critical` — never dropped
- When a section is dropped: replaced with a one-line notice in non-AI output: `[Section omitted — budget N tokens]`. In AI output, no notice (clean output).

**`--budget` flag:**
- `mai render <file> --budget=4000` — renders with 4,000 token budget
- `mai render <file> --budget=4000 --consumer=ai` — budget + consumer combined
- No `--budget`: no budget pass, all sections rendered
- Budget of 0: treated as "no budget" (not as "render nothing")

**`--chunk-map` flag:**
- `mai render <file> --chunk-map` — emits a sidecar JSON file `<output>.chunks.json` alongside the rendered output
- Format: `{ chunks: [{ id, standalone, startLine, endLine }] }` — absolute line numbers in the rendered output
- Designed for RAG ingestion pipelines

**`@chunk-boundary` rendering:**
- In standard output: renders as an HTML comment `<!-- chunk: id -->` — invisible in rendered markdown, parseable by RAG tools
- In AI output (`--format=ai`): renders as `---chunk:id---` inline marker — visible to AI parsers
- `standalone: true` is included in the chunk-map as a metadata hint to RAG systems that this chunk is self-contained

**`@section` without `--budget`:** sections render normally — `@section` / `@end` markers disappear, content renders as-is. No visible effect unless budget is applied.

**Nesting:** `@section` blocks may be nested. Inner sections are dropped first (by priority) before outer sections.

## Data Flow

Greenfield. Budget pass is a post-render step — it operates on the fully resolved markdown string, not the AST.

## Dependencies

- **01-parser** — two new directive modules (`section.ts`, `chunk-boundary.ts`) registered in the directive registry.
- **03-engine** — `budget.ts` added as a post-render pass. Engine runs it when `ctx.budget > 0`.
- **04-cli-core** — `render.ts` gains `--budget` and `--chunk-map` flags.

## Security

`@section` and `@chunk-boundary` are structural markers. No file reads, no process spawning, no network calls. No security concerns beyond standard directive body treatment. The `--budget` and `--chunk-map` flags are CLI-provided integers/booleans — no injection surface.

## Known Issues

(none)
