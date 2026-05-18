---
id: 05-lang-header
title: Language — Header Declaration and Runtime Detection
edition: Both
depends_on: [01-parser]
source_files:
  - packages/parser/src/directives/header.ts
wave: markdownai-core-wave-2
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-18
status: complete
mdd_version: 1
tags: [header, declaration, runtime-detection, opt-in, version-pin, frontmatter]
path: Language/Header
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 05 — Language — Header Declaration and Runtime Detection

## Purpose

The `@markdownai` header on line 1 is the opt-in mechanism and the runtime detection signal. No config, no file extension, no sidecar. The first line is the contract.

## Business Rules

- `@markdownai` must be the very first line of the file, OR the first line after a YAML frontmatter block
- YAML frontmatter: if line 1 is `---`, the parser scans for the closing `---`, skips any blank lines after it, then checks the next line for `@markdownai`
- Frontmatter lines are emitted as passthrough markdown nodes and appear in rendered output
- Valid forms: `@markdownai` or `@markdownai v1.0`
- Version pin format: `v` followed by `major.minor` (e.g. `v1.0`, `v1.1`, `v2.0`)
- If version pin present and installed version is older → log WARN, continue (not an error)
- If the first meaningful line does not start with `@markdownai` → `isMarkdownAI: false`, return immediately
- Standard renderers display `@markdownai` as a plain text paragraph -- graceful degradation
- Adding MarkdownAI to an existing file: add `@markdownai` as line 1 (or after frontmatter)
- Removing MarkdownAI: delete the `@markdownai` line only

## Implementation Notes

The parser's first action is always to check the first meaningful line (skipping YAML frontmatter if present). If absent, the entire file returns as `{ isMarkdownAI: false, version: null, nodes: [] }`. The engine, renderer, and CLI all check `isMarkdownAI` before proceeding.

## Known Issues
(none)
