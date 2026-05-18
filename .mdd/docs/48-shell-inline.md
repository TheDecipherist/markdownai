---
id: 48-shell-inline
title: Shell Inline -- Native !`command` Interception and Security Gating
edition: Both
depends_on: [12-lang-conditionals, 20-lang-sources-query, 24-security-shell, 47-skill-context-variables]
source_files:
  - packages/parser/src/parser.ts
  - packages/parser/src/parser-state.ts
  - packages/parser/src/interpolation.ts
  - packages/engine/src/engine.ts
  - packages/engine/src/engine-interpolate.ts
  - packages/engine/src/__tests__/shell-inline.test.ts
wave: markdownai-core-wave-5
wave_status: complete
initiative: markdownai-core
last_synced: 2026-05-16
status: complete
mdd_version: 1
tags: [shell, inline, security, claude-code, interception, query, gating]
path: Engine/Security
---

# 48 -- Shell Inline -- Native !`command` Interception and Security Gating

## Purpose

Claude Code skill files support a native shell injection syntax: `` !`command` ``. It runs the command before Claude sees the file and injects the output inline. No security gates, no allowlist, no jailRoot -- whatever is written runs.

When a file is `@markdownai`, that is not acceptable. MarkdownAI takes ownership of all shell execution within its documents, including `` !`command` `` patterns written in the Claude Code style. The parser recognizes them as first-class AST nodes. The engine evaluates them through the same security layer as `@query`.

Users who prefer the Claude Code syntax can write `` !`command` `` and get MarkdownAI's security gates for free. Users who want to opt out of interception can set `shell-inline: passthrough` in the document header, and the tag is left as-is for Claude Code to handle natively.

## Business Rules

**Interception is the default.** In any `@markdownai` document, `` !`command` `` is a recognized syntax. The parser emits a `ShellInlineNode`. The engine evaluates it.

**Execution follows `allowShell`.** The same flag that gates `@query` gates shell inline:
- `allowShell: false` (default) -- command is blocked. Engine emits a warning and replaces the tag with nothing.
- `allowShell: true` -- command runs through the deny-pattern check and jailRoot confinement, same as `@query`. Output replaces the tag inline.

**Opt-out via document header.** A document can disable interception:

```
@markdownai shell-inline="passthrough"
```

With `passthrough`, the parser emits the raw `` !`command` `` text unchanged. Claude Code's native evaluation handles it. MarkdownAI does not gate it. This is intentionally named "passthrough" not "disable" -- the author is explicitly handing control back to Claude Code, which has no security gates.

**Inline output, no label.** Unlike `@query`, shell inline has no label. Output replaces the tag at the point it appears. It cannot be referenced elsewhere or used in `@if` conditions. For reuse and conditions, `@query` is the right tool.

**Mixed documents work.** A file can use both `` !`command` `` and `@query`. Both are gated by the same security config. Authors can choose whichever syntax reads more naturally for the context.

## Syntax

Standard inline form -- appears anywhere in document body:

```
Current branch: !`git branch --show-current`
Files changed: !`git diff --stat | wc -l`
```

Blocked (default -- `allowShell: false`):

```
Build: !`make build`
```
Engine blocks, emits warning: `Shell inline blocked: allowShell is false`

Opt-out:

```
@markdownai shell-inline="passthrough"
```

## AST Node

```typescript
export interface ShellInlineNode {
  type: 'shell-inline'
  command: string   // raw command string, without backticks
  raw: string       // original !`...` token
}
```

Emitted inline within paragraph content, alongside text runs and interpolation nodes.

## Engine Evaluation

1. Walk document AST. On `ShellInlineNode`, check `ctx.security.allowShell`.
2. If `false` -- push warning, emit empty string, continue.
3. If `true` -- run command through `ShellSecurityConfig` deny patterns. If blocked, push warning, emit empty string.
4. If passes -- execute via the same Node.js `child_process` path as `@query`. Capture stdout.
5. Replace node with trimmed stdout in output.
6. Timeout: same as `@query` (configurable, default 10s).

## Security Comparison

| Control | `@query` | `` !`command` `` via MarkdownAI | `` !`command` `` via Claude Code |
|---|---|---|---|
| Disabled by default | Yes | Yes (same `allowShell`) | No -- always runs |
| Command allowlist | Yes | Yes (same gates) | No |
| Deny patterns | Yes | Yes (same gates) | No |
| Filesystem jail | Yes | Yes (same jailRoot) | No |
| Immutable block rules | Yes | Yes | No |
| Audit log | Yes | Yes | No |
| User can opt out | No | Yes (`passthrough`) | N/A |

**Documentation note:** This comparison is a key differentiator for MarkdownAI skill files vs raw Claude Code skill files. Any MarkdownAI document, whether used as a Claude Code skill or a standalone runbook, routes all shell execution through the security layer. A `@markdownai` document cannot be used as a vector for ungated shell execution -- even if the author uses Claude Code's own syntax.

## Scope Advantage

`@query` and shell inline both work in any MarkdownAI document -- not just Claude Code skills. Runbooks, spec documents, dashboards, phase documents: all contexts get the same behaviour. Claude Code's `` !`command` `` only fires in skill files and is evaluated outside any security layer.

## Implementation Plan

1. **Parser** -- add inline scanner that recognizes `` !`...` `` patterns within paragraph text and emits `ShellInlineNode`. Must not fire inside fenced code blocks or inline code spans.
2. **Engine** -- add `ShellInlineNode` handler. Reuse existing shell execution path from `@query`. Check `allowShell`, run deny patterns, execute, replace with stdout.
3. **Header option** -- parse `shell-inline="passthrough"` in `@markdownai` header. When set, parser skips `ShellInlineNode` emission and leaves raw text.
4. **Tests** -- blocked by default, runs with `allowShell: true`, deny pattern blocks dangerous commands, passthrough leaves raw text, timeout respected, mixed with `@query` in same doc.

## Known Issues

(none)
