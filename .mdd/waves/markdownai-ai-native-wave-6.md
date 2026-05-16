---
id: markdownai-ai-native-wave-6
title: "Wave 6: AI-Native E2E Tests and Format Benchmarks"
initiative: markdownai-ai-native
initiative_version: 2
status: planned
depends_on: markdownai-ai-native-wave-5
demo_state: "e2e test suite passes for all 6 AI-native features; benchmark report in e2e/benchmarks/ai-format-report.md shows real token savings per fixture with before/after counts; e2e/rendered-ai/ holds human-inspectable ai-format outputs that can be visually diffed against e2e/rendered/"
created: 2026-05-16
hash: d2bab259
---

# Wave 6: AI-Native E2E Tests and Format Benchmarks

## Demo-State

Running `npm run test:e2e` passes all AI-native tests. A benchmark report at `e2e/benchmarks/ai-format-report.md` exists with real token counts and savings percentages for each fixture. `e2e/rendered-ai/` contains human-readable versions of every fixture rendered in ai-format — a developer can open these beside `e2e/rendered/` and confirm no information was lost.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | ai-e2e-accuracy | .mdd/docs/40-ai-e2e-accuracy.md | planned | — |

## Open Research

(none)
