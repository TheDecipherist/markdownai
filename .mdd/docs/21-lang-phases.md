---
id: 21-lang-phases
title: Language — @phase, @on complete, and @graph
edition: Both
depends_on: [08-lang-macros, 10-lang-include]
source_files:
  - packages/parser/src/directives/phase.ts
  - packages/parser/src/directives/graph.ts
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [phases, transitions, workflow, mcp, lazy-loading, graph, visualization, mermaid]
path: Language/Phases
known_issues: []
---

# 21 — Language — @phase, @on complete, and @graph

## Purpose

`@phase` declares named workflow phases with transition rules. The MCP server loads only the active phase into AI context. `@graph` is documentation-only visualization using Mermaid in `mai-graph` fenced blocks.

## Business Rules

**@phase grammar:**
```
@phase name
  [body: any directives]
  @on complete -> next-phase-name
  @on complete -> @call macro_name
@end
```

**@on complete -> rules:**
- Only valid inside @phase ... @end -- parse error outside
- Multiple @on complete lines execute sequentially top-to-bottom
- `event: "complete"` is the only current event value (extensible in future)
- Phase transition action: `{ type: "phase", name: string }`
- Macro call action: `{ type: "macro", name: string, args: Record<string, string> }`

**@phase scope rules:**
- Root document only -- @phase in @import file → parse error
- @phase in @include file → @phase/@end tags stripped, body renders normally
- Phases optional -- document without phases loads in full

**@graph:**
- Fenced block with language tag `mai-graph` (not mdai-graph)
- Documentation only -- NEVER affects runtime behavior
- @on complete -> transitions are always the source of truth for phase sequencing
- @graph may be incomplete, aspirational, or absent -- no runtime effect
- Mismatches with @phase declarations → WARN during validate --verbose only
- MCP server uses @graph for visualization only; phase structure derived from transitions
- Passes through unchanged in stripper

**PhaseNode TypeScript interface:** (see parser feature doc)

## Known Issues
(none)
