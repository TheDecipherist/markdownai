---
id: 20-lang-sources-query
title: Language — @query Shell Command Directive
edition: Both
depends_on: [13-lang-pipeline]
source_files:
  - packages/parser/src/directives/query.ts
  - packages/engine/src/shell.ts
wave: markdownai-core-wave-2
wave_status: planned
initiative: markdownai-core
last_synced: 2026-05-14
status: draft
mdd_version: 1
tags: [query, shell, command-execution, jailed, allowlist, unix]
path: Language/Sources
known_issues: []
---

# 20 — Language — @query Shell Command Directive

## Purpose

Executes shell commands and returns stdout as pipeable output. Jailed -- stripped by default. The escape hatch for anything not covered by other directives.

## Business Rules

**Jailed directive:** stripped silently unless command matches a pattern in `~/.markdownai/security.json` shell allowlist.

**Syntax:** `@query "shell command here"`

**Evaluation:**
- Command evaluated against allowlist patterns -- shell.ts handles execution
- Returns stdout as string, pipeable
- Stderr discarded unless --verbose
- Non-zero exit → empty string, WARN logged; --strict makes it error
- `@cache session|persist|ttl=N|mock=./file.json` -- last modifier

**Common patterns:**
- `@query "git log --oneline -1"` -- last commit
- `@query "git log --follow --format=%aI --diff-filter=A -- ./file | tail -1"` -- file creation date via git
- `@query "npm audit --json"` -- dependency audit
- `@query "docker ps --format json"` -- container list

**Built-in always_block patterns prevent dangerous commands** regardless of allowlist -- see security-immutable-rules feature.

## Known Issues
(none)
