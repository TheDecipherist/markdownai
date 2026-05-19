# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What This Is

MarkdownAI -- a superset of markdown that makes documents live.
Full specification: `MDs/markdownai-spec-v1.0.md`
Tagline: "documentation that cannot lie."

## MDD — Build Approach

This project uses MDD (Manual-Driven Development). Always start a session with `/mdd`
to load project context. Each feature is documented before it is built — use
`/mdd <description>` for a single feature, or `/mdd plan-initiative` to coordinate
multiple features in waves. When an initiative is active, build in wave order and
do not skip waves.

The `.mdd/docs/` directory contains one feature doc per feature. Each doc is the
authoritative source of truth for what to build. Read it fully before writing any code.

**Learning from mistakes**
All code in this project is built via the MDD workflow. Whenever a bug, flaw, or gap
is found — or if a feature doc changes or gains new frontmatter fields — document why
it happened and how it could have been prevented. When a fix is identified, ask the
user if you should open a GitHub issue on their behalf at
https://github.com/TheDecipherist/mdd/issues with a clear description of the problem
and a suggested fix so it can be patched in the workflow for all users (best practices,
security hardening, performance optimization).

**After an MDD patch is published**
Run `mdd update` (global) or `mdd update --install-local` (project) to sync this
project to the latest version.

## Architecture

Six packages in an npm workspaces monorepo:

```
packages/
  parser/     @markdownai/parser    -- AST production only, no execution
  renderer/   @markdownai/renderer  -- 11 format modules, ASCII output
  engine/     @markdownai/engine    -- execution, env resolution, pipe, cache, strip
  mcp/        @markdownai/mcp       -- MCP server, 9 tools, phase navigation
  core/       @markdownai/core      -- mai binary, all CLI commands
  vscode/     markdownai (VS Code)  -- language detection, snippets, completions, hover, diagnostics
```

The stripper (`mai strip`) is in `packages/engine/src/stripper.ts`, not a separate package.

## TypeScript Rules

- Strict mode always -- `"strict": true` in all tsconfigs
- No `any` -- use `unknown` and narrow
- ESM (`"type": "module"`) -- all imports in src/ use `.js` extensions (NodeNext resolves to .ts)
- Target ES2022, Node >= 18
- One directive module per directive: `packages/parser/src/directives/<name>.ts`

## Code Quality Rules

- No file > 300 lines
- No function > 50 lines
- No `console.log` in library code -- use the logger
- Never use `eval()` -- use `vm.runInNewContext` for expression evaluation
- Never spawn child processes from parser -- parser is pure AST only
- No Mongoose -- native MongoDB driver only if/when MongoDB is used

## CLI Binary

- Binary name: `mai` (not `markdownai`)
- Commander.js for CLI framework
- Universal flags on every command: `--env`, `--cwd`, `--verbose`, `--strict`, `--silent`
- `--silent` never suppresses SECURITY_ALERT or FATAL

## Security Non-Negotiables

- `eval()` is never used anywhere -- `vm.runInNewContext` only
- Cloud metadata endpoints (169.254.169.254 etc) always blocked -- no exceptions
- Content masking applied before caching -- sensitive values never stored
- Document root confinement always active for @include/@import/@read
- Built-in immutable rules cannot be overridden by any config

## Cross-Platform

- Built-in pipe commands (grep, sort, head, tail, wc -l, uniq) are pure Node.js implementations -- no shell spawning
- Shell-dependent commands (awk, sed, jq etc) spawn child processes -- Unix/WSL only
- Engine detects platform at startup for shell command availability

## Git Workflow

- Never commit to main
- One feature per branch: `feat/<feature-slug>`
- Follow conventional commits
- Never commit .env or any secrets

## Key Reference

The spec at MDs/markdownai-spec-v1.0.md is the mdd initial build document source for:
- All directive syntax and options
- AST node types and TypeScript interfaces
- Security rules and evaluation order
- Cache modes and behavior
- File resolution model (circular detection, first-wins)
- Expression system operators

Most up to date spec/manual is at .mdd/manual/manual.md

When in doubt, read the manual.

## MarkdownAI Formatting Style

When writing or generating MarkdownAI files, indent body content inside block directives
by 2 spaces. `@end` (or `@endif`) closes at the same indent level as the opener.

Block directives that require `@end`: `@phase`, `@define`, `@note`, `@section`, `@prompt`
Block directive that requires `@endif`: `@if` (also `@else` at the opener level)
Single-line directives with no closing tag: `@constraint`, `@define-concept`, `@env`,
`@include`, `@import`, `@call`, `@on complete`, `@read`, `@list`, `@tree`, `@count`,
`@http`, `@chunk-boundary`

Example:
```
@phase setup
  @constraint[critical] Environment must be validated before proceeding
  @note visible
    This phase configures the runtime environment.
  @end
  @if env.CI
    Running in CI mode.
  @endif
  @on complete -> @phase main
@end
```
