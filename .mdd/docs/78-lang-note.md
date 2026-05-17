---
id: 78-lang-note
title: Language — @note Directive (Human-Readable Source Comments)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [12-lang-conditionals, 29-stripper, 35-ai-prompt]
source_files:
  - packages/parser/src/directives/note.ts
  - packages/parser/src/types.ts
  - packages/parser/src/registry.ts
  - packages/engine/src/engine.ts
  - packages/engine/src/stripper.ts
routes: []
models: []
test_files:
  - packages/core/src/__tests__/note.test.ts
data_flow: .mdd/audits/flow-lang-note-2026-05-17.md
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1
tags: [note, directive, source-comment, human-readable, stripped, consumer, visible, language]
path: Language/Note
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 78 — Language — @note Directive

## Purpose

`@note` is a block directive for human-readable source comments. By default it is
always stripped from rendered output - it exists purely to help a developer reading
the raw `.md` file understand what a nearby block does, especially in AI-optimised
documents where directive-heavy sections can be opaque.

With the `visible` argument, a `@note` block renders as a blockquote callout in
the document output. Combined with `consumer`, it can be scoped to render only for
a specific audience - human readers of the rendered document, or AI consumers via
MCP.

`@note` is the human-facing counterpart to `@prompt`. `@prompt` embeds instructions
for AI readers; `@note` embeds explanations for human readers of the source.

## Architecture

**Parser** — `packages/parser/src/directives/note.ts`

Parses the directive line and optional args. Returns a `NoteNode` with:
- `visible: boolean` — true only when the `visible` keyword appears in args
- `consumer?: string` — the value of `consumer="..."` if present (only meaningful when `visible=true`)
- `body: string` — the raw text content between `@note` and `@end`

`consumer` without `visible` is a no-op (the block strips regardless).

**Engine** — `packages/engine/src/engine.ts`

Adds `case 'note': return executeNote(node, ctx)` to the `walkNode` switch.

`executeNote` logic:
1. If `!node.visible` → return `''`
2. If `node.consumer` is set and does not match `ctx.consumer` → return `''`
3. Otherwise → render as blockquote: `> **Note:**\n> <body lines>`

**Stripper** — `packages/engine/src/stripper.ts`

Adds `case 'note': return ''` to `stripNode`. The `visible` flag is irrelevant
here — `mai strip` always strips `@note` blocks from plain-markdown output.

**Types** — `packages/parser/src/types.ts`

New `NoteNode` interface, added to `ASTNode` union.

## Data Model

No persistence. `NoteNode` is an AST node only.

```typescript
interface NoteNode extends ASTNodeBase {
  type: 'note'
  visible: boolean
  consumer?: string  // 'human' | 'ai' | any string — open for extensibility
  body: string
}
```

## API Endpoints

None. Parser directive only.

## Business Rules

**Syntax:**
```
@note
Always stripped. Source-only explanation.
@end

@note visible
Renders to all consumers as a blockquote callout.
@end

@note visible consumer="human"
Renders only when ctx.consumer === 'human'.
@end

@note visible consumer="ai"
Renders only when ctx.consumer === 'ai'.
@end
```

**Rules:**
- `@note` without `visible` → always returns `''` from the engine, always stripped by `mai strip`
- `visible` keyword is positional, not a key=value pair (matches @prompt's `role` pattern)
- `consumer` without `visible` is silently accepted but has no effect — the block strips
- Nested `@note` inside `@note` → ParseError: "nested @note is not supported"
- `@note` inside `@define` macros → valid; note body expands with the macro body and strips/renders normally at call site
- No valid `visible` argument values — `visible` is a flag, not a value
- `consumer` accepts any string value — unknown values silently produce no output (forward compatibility)

**Rendered output format (when visible and consumer matches):**
```markdown
> **Note:**
> first line of body
> second line of body
```

## Data Flow

**Source → AST:**
Parser sees `@note` line → calls `note.ts parse()` → returns `NoteNode` with
`visible`, optional `consumer`, empty `body`. Parser then fills `body` with
subsequent lines until `@end`.

**AST → Engine:**
`walkNode` hits `case 'note'` → calls `executeNote(node, ctx)`. Checks `visible`
then `consumer` against `ctx.consumer`. Returns `''` or blockquote string.

**AST → Stripper:**
`stripNode` hits `case 'note'` → returns `''`. `visible` is ignored.

**ctx.consumer** is already present in `EngineContext` — wired by the same
mechanism used by `executePrompt`. No new context fields needed.

## Dependencies

- `12-lang-conditionals`: `ctx.consumer` is part of the expression evaluation
  context; `@note`'s consumer filtering reuses this without changes
- `29-stripper`: `case 'note': return ''` follows the established switch pattern
  in `stripper.ts`
- `35-ai-prompt`: conceptual sibling and design reference — `@note` mirrors
  `@prompt`'s block structure and blockquote render format

## Security

`@note` accepts no expressions, runs no code, makes no network calls, reads no
files, and spawns no processes. The body is stored as a raw string and either
discarded or rendered verbatim. No sanitisation needed beyond what the existing
body-text pipeline already provides.

## Known Issues

(none yet)
