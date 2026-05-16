---
id: 05-lang-header
title: Language — Header Declaration and Runtime Detection
edition: Both
depends_on: [01-parser]
source_files:
  - packages/parser/src/directives/header.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [header, declaration, runtime-detection, opt-in, version-pin]
path: Language/Header
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 05 — Language — Header Declaration and Runtime Detection

## Purpose

The `@markdownai` header on line 1 is the opt-in mechanism and the runtime detection signal. No config, no file extension, no sidecar. The first line is the contract.

## Business Rules

- `@markdownai` must be the very first line of the file -- no BOM, no blank line before it
- Valid forms: `@markdownai` or `@markdownai v1.0`
- Version pin format: `v` followed by `major.minor` (e.g. `v1.0`, `v1.1`, `v2.0`)
- If version pin present and installed version is older → log WARN, continue (not an error)
- If line 1 is absent or does not start with `@markdownai` → `isMarkdownAI: false`, return immediately
- Standard renderers display `@markdownai` as a plain text paragraph -- graceful degradation
- Adding MarkdownAI to an existing file: add `@markdownai` as line 1 only
- Removing MarkdownAI: delete line 1 only

## Implementation Notes

The parser's first action is always to check line 1. If absent, the entire file returns as `{ isMarkdownAI: false, version: null, nodes: [] }`. The engine, renderer, and CLI all check `isMarkdownAI` before proceeding.

## Known Issues
(none)
