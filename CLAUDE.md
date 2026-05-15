# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What This Is

MarkdownAI -- a superset of markdown that makes documents live.
Full specification: `MDs/markdownai-spec-v1.0.md`
Tagline: "documentation that cannot lie."

## Build Approach

This project uses MDD (Methodology-Driven Development). Always start a session with `/mdd` to load project context. Features are built in wave order. Do not skip waves.

The .mdd/docs/ directory contains one feature doc per feature. Each feature doc is the authoritative source of truth for what to build. When implementing a feature, read its doc fully before writing any code.

## Architecture

Six packages in an npm workspaces monorepo:

```
packages/
  parser/     @markdownai/parser    -- AST production only, no execution
  renderer/   @markdownai/renderer  -- 11 format modules, ASCII output
  engine/     @markdownai/engine    -- execution, env resolution, pipe, cache
  stripper/   (built into core)     -- syntax removal, conditional evaluation
  mcp/        @markdownai/mcp       -- MCP server, phase tools
  core/       @markdownai/core      -- mai binary, all CLI commands
```

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

The spec at MDs/markdownai-spec-v1.0.md is the authoritative source for:
- All directive syntax and options
- AST node types and TypeScript interfaces
- Security rules and evaluation order
- Cache modes and behavior
- File resolution model (circular detection, first-wins)
- Expression system operators

When in doubt, read the spec.
