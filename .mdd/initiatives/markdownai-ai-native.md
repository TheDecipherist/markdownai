---
id: markdownai-ai-native
title: MarkdownAI — AI-Native Features
status: active
version: 2
hash: 64844238
created: 2026-05-16
---

# MarkdownAI — AI-Native Features

## Overview

Six new directives and rendering modes that make MarkdownAI the defacto standard for AI-consumable documentation. Every feature targets the gap between "markdown written for humans" and "markdown consumed by AI agents, RAG pipelines, and LLM context windows."

The core insight: AI doesn't need decorative formatting, navigation aids, or visual hierarchy. AI needs density, semantic structure, and embedded instruction. This initiative makes MarkdownAI documents AI-aware at the source level — they carry instructions for their AI readers, declare their own context budget, define their own concepts, and render into the most token-efficient form possible.

## Open Product Questions

(none — all features fully scoped and decided)

## Waves

| Wave | File | Demo-state | Status |
|------|------|------------|--------|
| Wave 5 | waves/markdownai-ai-native-wave-5.md | `mai render --consumer=ai --format=ai --budget=4000` works; @prompt/@define-concept/@constraint/@chunk-boundary all render correctly; rendered output is measurably smaller and semantically richer | planned |
| Wave 6 | waves/markdownai-ai-native-wave-6.md | e2e test suite passes; benchmark report shows real token savings per fixture; `e2e/rendered-ai/` holds human-inspectable ai-format output; accuracy verified (no information lost) | planned |
