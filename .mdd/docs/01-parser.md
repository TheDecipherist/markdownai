---
id: 01-parser
title: Parser — AST Production
edition: Both
depends_on: []
source_files:
  - packages/parser/package.json
  - packages/parser/tsconfig.json
  - packages/parser/src/types.ts
  - packages/parser/src/lexer.ts
  - packages/parser/src/parser.ts
  - packages/parser/src/registry.ts
  - packages/parser/src/directives/header.ts
  - packages/parser/src/directives/include.ts
  - packages/parser/src/directives/import.ts
  - packages/parser/src/directives/env.ts
  - packages/parser/src/directives/define.ts
  - packages/parser/src/directives/call.ts
  - packages/parser/src/directives/phase.ts
  - packages/parser/src/directives/connect.ts
  - packages/parser/src/directives/list.ts
  - packages/parser/src/directives/read.ts
  - packages/parser/src/directives/query.ts
  - packages/parser/src/directives/db.ts
  - packages/parser/src/directives/http.ts
  - packages/parser/src/directives/tree.ts
  - packages/parser/src/directives/date.ts
  - packages/parser/src/directives/count.ts
  - packages/parser/src/directives/render.ts
  - packages/parser/src/directives/if.ts
  - packages/parser/src/directives/graph.ts
  - packages/parser/src/directives/pipe.ts
  - packages/parser/src/__tests__/parser.test.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/parser.test.ts
data_flow: greenfield
last_synced: 2026-05-14
status: draft
phase: documentation
mdd_version: 1
tags: [parser, ast, directive-registry, single-pass, node-types, lexer, modularity]
path: Toolchain/Parser
wave: markdownai-core-wave-1
wave_status: planned
initiative: markdownai-core
known_issues: []
---

# 01 — Parser — AST Production

## Purpose

Reads `.md` source files and produces a structured AST. The foundation all other toolchain components depend on. The parser resolves nothing -- it only understands structure. Never touches the filesystem, environment, database, or any external resource.

## Architecture

Single-pass line reader. No backtracking. A directive registry pattern: each directive is a self-contained module in `src/directives/`. Adding a new directive means adding one file -- nothing else changes.

**Package:** `@markdownai/parser` -- published standalone.

```
packages/parser/
  src/
    directives/       one .ts file per directive
    registry.ts       loads all directive modules, exposes parse() dispatch
    lexer.ts          line-by-line tokenizer, handles fenced blocks
    parser.ts         builds AST from token stream
    types.ts          all TypeScript interfaces
  package.json
  tsconfig.json
  index.ts
```

## Data Model

**Parser output:**

```typescript
interface ParseResult {
  isMarkdownAI: boolean
  version: string | null      // e.g. "1.0" from "@markdownai v1.0", null if no version pin
  nodes: ASTNode[]
}
```

**ParseModule interface** (what the registry requires from each directive file):

```typescript
interface ParseModule {
  name: string      // directive name e.g. "include", "db"
  block: boolean    // true if directive uses @end closing tag
  parse(line: string, args: string, ctx: ParseContext): ASTNode
}
```

**Full node types with their directive sources:**

| Directive | AST Node type |
|---|---|
| `@markdownai` | `header` |
| `@include` | `include` |
| `@import` | `import` |
| `@env` | `env` |
| `@define ... @end` | `define` |
| `@call` | `call` |
| `@phase ... @end` | `phase` (contains `transition[]` children) |
| `@on complete ->` | `transition` (child of `phase` only) |
| `@connect` | `connect` |
| `@list` | `list` |
| `@read` | `read` |
| `@query` | `query` |
| `@db` | `db` |
| `@http` | `http` |
| `@tree` | `tree` |
| `@date` | `date` |
| `@count` | `count` |
| `@render` | `render` (sink -- only valid as last pipe stage) |
| `@if ... @endif` | `conditional` |
| Pipe chain (any line with unquoted `|`) | `pipe` |
| ` ```mai-graph` block | `graph` |
| `{{ expression }}` | `interpolation` (inline, immune inside fenced code blocks and backticks) |
| Unknown `@directive` | `passthrough` (never an error) |
| Everything else | `markdown` |

**PhaseNode structure:**

```typescript
interface PhaseNode extends ASTNodeBase {
  type: "phase"
  name: string
  body: ASTNode[]
  transitions: TransitionNode[]
}

interface TransitionNode extends ASTNodeBase {
  type: "transition"
  event: "complete"
  action: { type: "phase"; name: string } | { type: "macro"; name: string; args: Record<string, string> }
}
```

**PipeNode structure:**

```typescript
interface PipeNode extends ASTNodeBase {
  type: "pipe"
  stages: PipeStage[]
}

type PipeStage =
  | { type: "source"; node: ASTNode }
  | { type: "builtin"; command: string }
  | { type: "shell"; command: string }
  | { type: "sink"; node: RenderNode }
  | { type: "scalar" }
```

## Business Rules

- Line 1 only: `@markdownai` or `@markdownai v1.0` -- if absent, `isMarkdownAI: false`, return immediately, no further parsing
- A line beginning with `@` as the first non-whitespace character is a directive line
- **One directive per line** -- three explicit exceptions:
  1. Pipe chains: `@list ./src/ | sort | @render type="list"` -- entire line is one `pipe` node
  2. Phase transitions: `@on complete -> @call macro_name` -- `@call` is a transition action, only valid inside `@phase ... @end`
  3. Anything else with multiple `@` on one line → parse error
- Block directives (`@define`, `@phase`, `@if`) track nesting depth for `@end`/`@endif`
- `@on complete ->` outside a `@phase` block → parse error (not passthrough)
- `@phase` in an `@import`ed file → parse error
- `@phase` in an `@include`d file → valid (engine strips tags, body renders)
- `@local` is always the last token on `@define` and `@connect` lines -- parser extracts it before parsing args
- `@local` cannot be a parameter name (parameters never start with `@`)
- Pipe detection: split on unquoted `|` -- a `|` inside `"..."` is never a pipe separator
- `{{ }}` interpolation tokens are parsed inline, ignored inside fenced code blocks and backtick spans. `\{{` is a literal escape.
- Unknown `@directive` → `passthrough` node, always, never an error
- The parser never executes, resolves, strips, reads files, or touches external resources

## API Endpoints

None -- library package only.

## Known Issues

(none)
