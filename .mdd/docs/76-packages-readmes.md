---
id: 76-packages-readmes
title: Package README Files — All npm Packages
edition: Both
depends_on: [01-parser, 02-renderer, 03-engine, 04-cli-core, 30-mcp-server]
source_files:
  - packages/parser/README.md
  - packages/renderer/README.md
  - packages/engine/README.md
  - packages/mcp/README.md
  - packages/core/README.md
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1
tags: [npm, readme, documentation, packages, parser, renderer, engine, mcp, core]
path: Toolchain/Documentation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 76 — Package README Files — All npm Packages

## Purpose

Every published package in the @markdownai npm org needs its own README.md so developers landing on the individual npm package pages see detailed, useful documentation. Currently all five package pages show nothing. This feature adds complete README files to all five packages using the user manual as the primary content source.

## Architecture

Five standalone README.md files, one per package directory. No code changes. Each README follows the same structural template:
- Package name, tagline, and a compact inline nav to all other packages
- What the package is and why you'd use it
- Installation
- Full API / usage documentation for everything the package exports
- Security notes (where applicable)
- Links to the GitHub repo and npm org

The @markdownai/markdownai meta-package already has its own README (created in a prior session). This feature covers the five code packages.

## Content Source

The `.mdd/manual/manual.md` is the primary source. Each package has a corresponding section in the manual:
- `@markdownai/parser` - "Parser - AST Production" section
- `@markdownai/renderer` - "Renderer - Output Format Modules" section
- `@markdownai/engine` - "Engine - AST Execution" section + security + caching
- `@markdownai/mcp` - "MCP Server - AI Integration" section + all 8 tools
- `@markdownai/core` - "CLI Core" section + "CLI Complete" section + all commands

Source exports per package (from their index.ts files):
- **parser**: `parse`, `ParseError`, all AST types, `scanInterpolations`, `scanShellInlines`
- **renderer**: `render`, `aiFilter`, `AiFilterOptions`, all renderer types
- **engine**: `execute`, `strip`, `evalCondition`, `evalExpression`, `makeContext`, `resolveEnv`, `loadSecurityConfig`, `defaultSecurityConfig`, `isBuiltin`, `runBuiltin`, cache functions, context/security types
- **mcp**: `startServer`, 8 tool exports (`readFile`, `listPhases`, `resolvePhase`, `nextPhase`, `callMacro`, `getEnv`, `executeDirective`, `invalidateCache`), connection registry exports
- **core**: all command runners (render, validate, parse, eval, strip, build, init, serve, watch, cache, list-phases, list-macros, list-imports), `shouldRoute`, `isMarkdownAIFile`, all option/result types

## Standard Links Block (all READMEs)

Every README includes this at the top (after the package heading):

```
**All packages:** [core](link) · [engine](link) · [parser](link) · [renderer](link) · [mcp](link) · [@markdownai](meta-link)

**Links:** [GitHub](https://github.com/TheDecipherist/markdownai) · [npm org](https://www.npmjs.com/package/@markdownai/markdownai)
```

## Business Rules

- All READMEs use plain markdown (no @markdownai header - they are static npm docs)
- No em dashes anywhere (use hyphens)
- Write like a human - not AI filler language
- Code examples use real directive syntax from the manual
- Security-relevant packages (engine, core) include a security section
- Each README is self-contained - a developer landing there should need nothing else to get started

## Known Issues

None.
