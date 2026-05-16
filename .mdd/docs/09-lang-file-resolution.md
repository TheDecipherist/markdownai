---
id: 09-lang-file-resolution
title: Language — File Resolution Model
edition: Both
depends_on: []
source_files:
  - packages/engine/src/engine.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [file-resolution, circular-detection, diamond-dependency, first-wins, include, import]
path: Language/FileResolution
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 09 — Language — File Resolution Model

## Purpose

Defines how the engine tracks file processing state to detect circular references and handle diamond dependencies correctly. Shared by @include and @import.

## Business Rules

The engine maintains two structures during processing:

- `resolution_stack: Set<string>` -- files currently being processed (IN_PROGRESS)
- `completed_set: Set<string>` -- files fully processed (COMPLETE)

**Three outcomes:**

**1. Circular reference -- FATAL, always halts:**
A file that is IN_PROGRESS is encountered again via any @include or @import (cross-directive circularity is covered -- shared stack).
```
ERROR: Circular reference detected
  a.md (line 5)  @include b.md
  b.md (line 12) @import  a.md  ← cycle here
  Chain: a.md → b.md → a.md
```
Error shows: every file in chain, line number, directive type, cycle marker.
Always FATAL regardless of --strict mode.

**2. Duplicate @import -- skip silently (first wins):**
COMPLETE file encountered again via @import → skip, definitions already registered, no output, no warning.

**3. Duplicate @include -- render again:**
COMPLETE file encountered again via @include → render again at new call site. Intentional repetition is valid.

## Known Issues
(none)
