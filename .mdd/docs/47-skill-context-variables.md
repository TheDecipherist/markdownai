---
id: 47-skill-context-variables
title: Skill Context Variables — Claude Code Slash Command Integration
edition: Both
depends_on: [12-lang-conditionals, 30-mcp-server]
source_files:
  - packages/engine/src/context.ts
  - packages/engine/src/conditions.ts
  - packages/engine/src/engine.ts
  - packages/mcp/src/tools/read_file.ts
  - packages/mcp/src/server.ts
  - packages/engine/src/__tests__/conditions.test.ts
wave: markdownai-core-wave-5
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [skill, claude-code, arguments, conditions, mcp, expression-system, dispatch]
path: Engine/Conditions
---

# 47 — Skill Context Variables — Claude Code Slash Command Integration

## Purpose

Expose all Claude Code slash command invocation variables as first-class citizens in the MarkdownAI expression system. When a MarkdownAI document is executed as a Claude Code skill via the MCP `read_file` tool, `@if` conditions and `{{ }}` interpolations can reference `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `CLAUDE_EFFORT`, `CLAUDE_SESSION_ID`, `CLAUDE_SKILL_DIR`, and any named args declared in the skill frontmatter.

This enables genuine engine-evaluated dispatch in skill files — the engine routes to the correct `@include` based on the actual argument string, rather than embedding prose instructions for Claude to interpret.

## Business Rules

**SkillContext type** — added to `EngineContext` in `context.ts`:

| Field | Type | Description |
|---|---|---|
| `args` | `string` | Full raw `$ARGUMENTS` string |
| `argsList` | `string[]` | Positional args, shell-style parsed (handles quoted strings) |
| `namedArgs` | `Record<string, string>` | Named args from skill frontmatter `arguments:` list |
| `sessionId` | `string` | `${CLAUDE_SESSION_ID}` |
| `effort` | `string` | `${CLAUDE_EFFORT}` — `low`/`medium`/`high`/`xhigh`/`max` |
| `skillDir` | `string` | `${CLAUDE_SKILL_DIR}` — directory containing the skill file |

**Sandbox variables** — available in every `@if` and `{{ }}` expression when `skillContext` is set:

| Expression variable | Source |
|---|---|
| `ARGUMENTS` | `skillContext.args` |
| `args` | `skillContext.args` (alias) |
| `argsList` | `skillContext.argsList` |
| `arg0` `arg1` `arg2` `arg3` | `argsList[0]` through `argsList[3]` |
| `CLAUDE_SESSION_ID` | `skillContext.sessionId` |
| `CLAUDE_EFFORT` | `skillContext.effort` |
| `CLAUDE_SKILL_DIR` | `skillContext.skillDir` |
| Named arg keys | `skillContext.namedArgs` spread into root scope |

**Preprocessor conversions** — applied before `vm.runInNewContext`:

| Input syntax | Converted to | Note |
|---|---|---|
| `$ARGUMENTS[N]` | `argsList[N]` | Indexed access |
| `$ARGUMENTS` | `ARGUMENTS` | Full args string |
| `$N` (single digit) | `argsList[N]` | Positional shorthand |

Both `ARGUMENTS.startsWith("audit")` and `$ARGUMENTS.startsWith("audit")` are valid.

**Shell-style arg parsing** — `argsList` is produced by splitting `args` with `/"([^"]*)"|'([^']*)'|(\S+)/g`. Quoted strings are kept together: `"hello world" second` → `["hello world", "second"]`.

**Null safety** — when `skillContext` is `null` (non-skill execution), all skill variables default to empty string or empty array. No errors.

**MCP wire fields** — `read_file` tool accepts these new optional fields:

| MCP field | Maps to | Description |
|---|---|---|
| `skill_args` | `skillContext.args` + `argsList` | Raw `$ARGUMENTS` string |
| `skill_named_args` | `skillContext.namedArgs` | Object of named arg key→value |
| `skill_session_id` | `skillContext.sessionId` | `${CLAUDE_SESSION_ID}` |
| `skill_effort` | `skillContext.effort` | `${CLAUDE_EFFORT}` |
| `skill_dir` | `skillContext.skillDir` | `${CLAUDE_SKILL_DIR}` |

## Implementation Notes

**`conditions.ts` sandbox** — skill vars added alongside `env`, `file`, and `consumer`. Named args are spread into root scope so `@if issue !== ""` works when `namedArgs = { issue: "123" }`.

**No leakage** — when `skillContext` is null, all skill vars are empty string/empty array. Conditions that reference them will evaluate falsy gracefully.

**`exactOptionalPropertyTypes` fix** — pre-existing TypeScript error in `ai-directives.test.ts` was caught and fixed during this feature: `ctx: consumer ? { consumer } : undefined` → `ctx: consumer ? { consumer } : {}`.

## Tests

17 new tests in `packages/engine/src/__tests__/conditions.test.ts` under `describe('skill context variables', ...)`:

- ARGUMENTS equality and startsWith dispatch
- `args` alias
- `argsList[N]` direct and via `$ARGUMENTS[N]` preprocessor
- `$N` shorthand preprocessor
- `arg0`/`arg1` shortcuts
- Quoted args parsing
- `CLAUDE_EFFORT`, `CLAUDE_SESSION_ID`, `CLAUDE_SKILL_DIR`
- Named args in root scope
- Null skillContext defaults (no errors)

## `@query` vs Claude Code's `!`command`` Syntax

Claude Code skill files support a native shell injection syntax: `` !`command` ``. It runs the command before Claude sees the file and injects the output inline. MarkdownAI's `@query` covers the same use case but is strictly superior on every axis.

**Security comparison:**

| Control | `@query` | `` !`command` `` |
|---|---|---|
| Disabled by default | Yes - `allowShell: false` | No - always runs |
| Command allowlist | Yes - patterns in `ShellSecurityConfig` | No |
| Deny patterns | Yes - blocks dangerous commands | No |
| Filesystem jail | Yes - `jailRoot` confinement | No |
| Immutable block rules | Yes - always-block regardless of config | No |
| Audit log | Yes | No |

Claude Code's version is user-approval gated (permission prompts) but has no content-level rules. A malicious skill file with `` !`rm -rf ~/` `` prompts the user and may run. The equivalent `@query bash -c "rm -rf ~/"` is blocked by deny patterns before execution regardless of user input.

**Scope advantage:**

`@query` works in any MarkdownAI document - specs, runbooks, dashboards, reports, phase documents. The `` !`command` `` syntax only works in Claude Code skill files and is evaluated by Claude Code before the MCP even sees the file, bypassing the engine entirely.

**Named output advantage:**

`@query` stores output in a named label reusable across the document and in `@if` conditions. `` !`command` `` injects inline only - no label, no reuse, no conditions.

This comparison belongs in the final documentation as a clear differentiator for why MarkdownAI-native skill files via the MCP path are safer and more capable than raw Claude Code shell injection.

## Known Issues

(none)
