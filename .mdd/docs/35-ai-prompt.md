---
id: 35-ai-prompt
title: AI — @prompt Directive (Embedded AI Instructions)
edition: Both
depends_on: [01-parser, 03-engine, 34-ai-consumer-mode]
source_files:
  - packages/parser/src/directives/prompt.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/prompt.test.ts
  - packages/engine/src/__tests__/execute-prompt.test.ts
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: none
mdd_version: 1
tags: [prompt, ai-instructions, directive, embedded, consumer, ai-reader, context]
path: AI/Prompt
wave: markdownai-ai-native-wave-5
wave_status: planned
initiative: markdownai-ai-native
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 35 — AI — @prompt Directive (Embedded AI Instructions)

## Purpose

`@prompt` embeds instructions for AI readers directly inside a MarkdownAI document. When `consumer=ai`, the block renders as a prefixed instruction block. When `consumer=human`, it renders as a styled info callout. When consumer is not set, it renders as a callout (human default). This lets document authors shape how AI tools reason about their content — injecting domain constraints, calibration notes, and interpretation guidance without cluttering the human-readable version.

## Architecture

```
parser: @prompt → ASTNode type "prompt" with role and body
engine: executePrompt() → checks ctx.consumer → renders appropriately
  consumer="ai"    → "<!-- AI: {role} -->\n{body}\n<!-- /AI -->"  (or plain prefix)
  consumer="human" → "> ℹ️ **Note:** {body}\n" (blockquote callout)
  consumer not set → same as human rendering (safe default)
```

## Data Model

**Parser node:**
```typescript
interface PromptNode extends ASTNode {
  type: 'prompt'
  role: string    // optional role label: "context", "constraint", "calibration", "instruction"
  body: string    // block content, may span multiple lines
}
```

**Grammar:**
```
@prompt [role="<role>"]
<body lines>
@end
```

`role` is optional — defaults to `"context"` if not provided.

**Valid roles:** `context`, `constraint`, `calibration`, `instruction`. Unknown roles are accepted with a WARN but not rejected — forward compatibility.

## Business Rules

**When `consumer="ai"`** — render as a structured instruction prefix:
```
[AI INSTRUCTION — context]
When reading this document, note that all API endpoints require
an Authorization header unless explicitly marked as public.
[/AI INSTRUCTION]
```

**When `consumer="human"` or consumer not set** — render as a markdown blockquote callout:
```markdown
> **Note:** When reading this document, note that all API endpoints require
> an Authorization header unless explicitly marked as public.
```

**The `@prompt` block is ALWAYS rendered** — it is not hidden from either consumer. The rendering format differs, not the presence. Authors who want to hide it from humans must wrap in `@if consumer="ai"`.

**Nesting:** `@prompt` blocks may not be nested inside each other. The parser reports an error if a `@prompt` opens before the previous one is closed.

**Multiple `@prompt` blocks per document:** allowed. They render in document order.

**`@prompt` inside `@define`/`@call`:** allowed — the prompt renders when the macro is called.

**`@prompt` inside `@if`:** allowed — the prompt renders only if the condition is met.

**Stripper behavior:** `mai strip` removes `@prompt ... @end` blocks entirely (they are directives, not prose).

**MCP server:** when an MCP tool returns rendered document content with `consumer="ai"`, the `@prompt` blocks render in their AI form — their instructions are live for the AI reader consuming the document via MCP.

## Data Flow

Greenfield. `@prompt` blocks are parsed into PromptNode AST nodes, collected during the engine's walk, and rendered by `executePrompt()` based on `ctx.consumer`.

## Dependencies

- **01-parser** — new directive module `prompt.ts` registered in the directive registry.
- **03-engine** — `executePrompt()` added to the directive handler map.
- **34-ai-consumer-mode** — `ctx.consumer` is the variable that controls rendering format.

## Security

`@prompt` content is author-controlled document content — the same trust level as any other directive body. It is never executed. It is rendered as plain string output (not HTML, not eval'd). No security concerns beyond the standard directive body treatment.

## Known Issues

(none)
