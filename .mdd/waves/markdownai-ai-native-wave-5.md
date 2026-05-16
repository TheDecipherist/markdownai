---
id: markdownai-ai-native-wave-5
title: "Wave 5: AI-Native Features"
initiative: markdownai-ai-native
initiative_version: 1
status: planned
depends_on: markdownai-core-wave-4
demo_state: "`mai render --consumer=ai --format=ai --budget=4000` works; @prompt/@define-concept/@constraint/@chunk-boundary all render correctly; MCP server defaults to ai format; rendered output is measurably smaller and semantically richer than plain markdown"
created: 2026-05-16
hash: 1d840a2c
---

# Wave 5: AI-Native Features

## Demo-State

`mai render --consumer=ai --format=ai --budget=4000` works. @prompt embedded instructions render for AI readers and are hidden for human readers. @define-concept produces a glossary block. @constraint surfaces machine-readable rules. @chunk-boundary emits semantic split points for RAG. The MCP server always uses ai format when returning rendered documents to Claude. Rendered output is measurably smaller and semantically richer than plain markdown.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | ai-consumer-mode | .mdd/docs/34-ai-consumer-mode.md | planned | — |
| 2 | ai-prompt | .mdd/docs/35-ai-prompt.md | planned | ai-consumer-mode |
| 3 | ai-context-budget | .mdd/docs/36-ai-context-budget.md | planned | — |
| 4 | ai-concepts | .mdd/docs/37-ai-concepts.md | planned | ai-consumer-mode |
| 5 | ai-constraints | .mdd/docs/38-ai-constraints.md | planned | ai-consumer-mode |
| 6 | ai-format | .mdd/docs/39-ai-format.md | planned | — |

## Open Research

(none)
