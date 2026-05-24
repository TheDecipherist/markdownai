---
id: 02-renderer
title: Renderer — Output Format Modules
edition: Both
depends_on: [01-parser]
source_files:
  - packages/renderer/package.json
  - packages/renderer/tsconfig.json
  - packages/renderer/src/formats/list.ts
  - packages/renderer/src/formats/numbered.ts
  - packages/renderer/src/formats/links.ts
  - packages/renderer/src/formats/table.ts
  - packages/renderer/src/formats/code.ts
  - packages/renderer/src/formats/inline.ts
  - packages/renderer/src/formats/bar.ts
  - packages/renderer/src/formats/flow.ts
  - packages/renderer/src/formats/tree.ts
  - packages/renderer/src/formats/timeline.ts
  - packages/renderer/src/formats/json.ts
  - packages/renderer/src/renderer.ts
  - packages/renderer/src/index.ts
  - packages/renderer/src/types.ts
  - packages/renderer/src/ai-filter.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-15
status: complete
phase: all
mdd_version: 1
tags: [renderer, formatting, ascii-charts, output-types, modular-formats, markdown-output]
path: Toolchain/Renderer
wave: markdownai-core-wave-1
wave_status: complete
initiative: markdownai-core
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 02 — Renderer — Output Format Modules

## Purpose

Takes piped data and renders it as markdown. Eleven format modules, each responsible for one output type. All charts and visualizations are ASCII -- no Mermaid, no JavaScript, no dependencies.

**Package:** `@markdownai/renderer` -- published standalone.

## Architecture

```
packages/renderer/
  src/
    formats/
      list.ts        unordered markdown list
      numbered.ts    ordered markdown list
      links.ts       list of markdown links
      table.ts       markdown table (GFM pipe format)
      code.ts        fenced code block
      inline.ts      plain string, no wrapping
      bar.ts         ASCII horizontal bar chart
      flow.ts        ASCII flow diagram with arrows
      tree.ts        ASCII indented tree for nested structures
      timeline.ts    ASCII left-to-right timeline
      json.ts        pretty-printed fenced JSON block
    renderer.ts      dispatches to format modules by type name
  index.ts
```

## Data Model

**Renderer interface:**

```typescript
interface RendererInput {
  type: RenderType
  data: string[]        // one item per line from pipe
  columns?: string[]    // column names if tabular
}

type RenderType =
  | "list" | "numbered" | "links"
  | "table" | "code" | "inline"
  | "bar" | "flow" | "tree"
  | "timeline" | "json"
```

**Format module interface:**

```typescript
interface FormatModule {
  name: RenderType
  render(data: string[], options?: Record<string, string>): string
}
```

## Business Rules

- All charts are ASCII -- renders in terminals, AI context windows, email, any plain text viewer. Zero dependencies.
- `bar` chart: fixed-width horizontal bars using `█` characters, label left-padded for alignment
- `flow` chart: nodes and arrows using `→` and `│`, auto-layout left-to-right
- `tree` chart: indented tree using `├──` / `└──` / `│` characters for nested data structures
- `timeline`: left-to-right with `──►` connectors between events
- `table`: GFM pipe table format with alignment dashes
- `json`: wraps in ` ```json ``` ` fenced block with 2-space indentation
- `inline`: returns data joined with space, no markdown wrapping -- for scalar embedding
- `code`: wraps in fenced code block, auto-detects language from data if possible
- Renderer dispatches by `type` string -- unknown type → throw with message listing valid types
- `renderer.ts` is the sole public API -- format modules are never imported directly

## Known Issues

(none)
