---
id: 04-cli-core
title: CLI Core — mai render, validate, parse, eval
edition: Both
depends_on: [01-parser, 02-renderer, 03-engine]
source_files:
  - packages/core/package.json
  - packages/core/tsconfig.json
  - packages/core/src/cli.ts
  - packages/core/src/commands/render.ts
  - packages/core/src/commands/validate.ts
  - packages/core/src/commands/parse.ts
  - packages/core/src/commands/eval.ts
  - packages/core/index.ts
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-15
status: complete
phase: all
mdd_version: 1
tags: [cli, mai, render, validate, parse, eval, commander, monorepo]
path: Toolchain/CLI
wave: markdownai-core-wave-1
wave_status: complete
initiative: markdownai-core
known_issues: []
---

# 04 — CLI Core — mai render, validate, parse, eval

## Purpose

The `mai` binary entry point. Wave 1 implements four commands sufficient to validate the parser, renderer, and engine are working: `render`, `validate`, `parse`, `eval`. The full CLI is completed in Wave 4 (`32-cli-complete`).

**Package:** `@markdownai/core` -- publishes the `mai` binary globally.

## Architecture

```
packages/core/
  src/
    cli.ts                  Commander.js entry, registers all commands
    commands/
      render.ts             mai render -- full AST resolution to markdown
      validate.ts           mai validate -- parse + report errors/warnings
      parse.ts              mai parse -- output raw AST as JSON
      eval.ts               mai eval -- evaluate a single expression
  index.ts
```

## Business Rules

**Universal flags (all commands):**
- `--env <file>` -- load .env file into envFiles
- `--cwd <path>` -- override working directory
- `--verbose` -- print WARN and above to terminal
- `--strict` -- treat WARN as errors, halt on any stripped/jailed directive
- `--silent` -- suppress all output except FATAL and SECURITY_ALERT
- `--version` -- print package version
- `--help` -- print help

**`mai render <file>`:**
- Parse file → engine executes AST → print rendered markdown to stdout
- `--output, -o <path>` -- write to file instead of stdout
- On FATAL parse error → stderr + exit 1
- On jailed directive (security) → strip it, print WARN if --verbose, continue

**`mai validate <file>`:**
- Parse file, report all errors and warnings without producing output
- Exit 0 if no errors, exit 1 if any errors
- Reports: missing @include files, undefined @call macros, @env vars with no fallback, jailed directives that will be stripped, `@if` conditions with unset vars
- `--strict` → warnings become errors

**`mai parse <file>`:**
- Parse file → print ParseResult as JSON to stdout
- `--node <type>` -- filter to specific node type
- `--pretty` -- pretty-print JSON (default: minified)

**`mai eval "<expression>"`:**
- Evaluate a single expression string against current environment
- `--env <file>` -- load env for evaluation
- Print result to stdout (true/false/string)
- Useful for: `mai eval "file.exists './src/enterprise/'"` → `false`

**Shared behavior:**
- FATAL and SECURITY_ALERT always print to stderr regardless of --silent
- Binary name is `mai` not `markdownai`
- ESM module, Node.js >= 18

## Known Issues

(none)
