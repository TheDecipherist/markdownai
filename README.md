<p align="center">
  <img src="docs/markdownAI_hero.webp" alt="MarkdownAI - Documentation That Cannot Lie" width="100%" />
</p>

# MarkdownAI

> **documentation that cannot lie.**

<p align="center">
  <a href="#quick-start">
    <img src="https://img.shields.io/badge/Quick_Start-Get_running_in_60s-0891b2?style=for-the-badge&labelColor=1e293b" alt="Quick Start" />
  </a>
  &nbsp;
  <a href="#directive-reference">
    <img src="https://img.shields.io/badge/Directives-Full_Reference-059669?style=for-the-badge&labelColor=1e293b" alt="Directive Reference" />
  </a>
</p>

[![npm](https://img.shields.io/badge/npm-%40markdownai%2Fmarkdownai-red)](https://www.npmjs.com/package/@markdownai/markdownai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Tests: 689](https://img.shields.io/badge/tests-689_passing-brightgreen)](./packages)

---

## The Problem With Documentation

Here is something that happens at every company, every team, every project: someone writes great documentation. It is accurate. It is detailed. It is helpful.

Then the code changes.

The database schema gets a new field. The API endpoint moves. The environment variable gets renamed. The service goes from port 3000 to 8080. But the docs stay exactly as they were - frozen at the moment someone last had time to update them. Within weeks, the documentation is wrong. Within months, it actively misleads. People stop trusting it. Eventually, they stop reading it.

This is not a process failure. This is physics. Static text cannot track a moving system.

**MarkdownAI is the solution.** Add `@markdownai` to the first line of any `.md` file, and it becomes a live document. Instead of writing values that will go stale, you write directives that fetch the current value every time the document is rendered. Your database record count is queried when someone reads the doc, not when you wrote it. Your API response is real. Your environment variables are live. Your file tree reflects what's actually on disk right now.

Run `mai render`. The document executes. The output is clean, standard Markdown with everything resolved.

The result is documentation that cannot lie - because it doesn't store facts, it fetches them.

---

## Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Language Features](#language-features)
  - [The @markdownai Header](#the-markdownai-header)
  - [Inline Interpolation {{ }}](#inline-interpolation--)
  - [@env - Environment Variables](#env---environment-variables)
  - [@define and @call - Macros](#define-and-call---macros)
  - [@include - Content Inclusion](#include---content-inclusion)
  - [@import - Definition Import](#import---definition-import)
  - [@if - Conditionals and Expression System](#if---conditionals-and-expression-system)
  - [Pipe Operator and @render](#pipe-operator-and-render)
- [Data Sources](#data-sources)
  - [@list - Filesystem and Structured Data](#list---filesystem-and-structured-data)
  - [@read - Structured File Access](#read---structured-file-access)
  - [@tree, @date, @count - Utility Directives](#tree-date-count---utility-directives)
  - [@connect and @db - Database Queries](#connect-and-db---database-queries)
  - [@http - HTTP Requests](#http---http-requests)
  - [@query - Shell Commands](#query---shell-commands)
  - [@phase, @on complete, and @graph](#phase-on-complete-and-graph)
- [Security](#security)
  - [Security Config and Runtime Modes](#security-config-and-runtime-modes)
  - [Filesystem Confinement](#filesystem-confinement)
  - [Shell Execution Jail](#shell-execution-jail)
  - [Database Query Jail](#database-query-jail)
  - [HTTP Request Jail](#http-request-jail)
  - [Immutable Built-in Rules](#immutable-built-in-rules)
- [Caching](#caching)
- [Output Formats](#output-formats)
- [Claude Code and AI Integration](#claude-code-and-ai-integration)
  - [MCP Server](#mcp-server)
  - [PreToolUse Hook](#pretooluse-hook)
  - [Skill Context Variables](#skill-context-variables)
  - [Shell Inline Interception](#shell-inline-interception)
  - [AI-Native Features](#ai-native-features)
- [CLI Reference](#cli-reference)
- [Directive Reference](#directive-reference)
- [MDD Integration](#mdd-integration)
- [Installation](#installation)
- [Architecture](#architecture)

---

## Quick Start

```bash
npm install -g @markdownai/core
```

Create your first live document:

```markdown
@markdownai

# Project Status

**Branch:** {{ @query git branch --show-current }}
**Tests:** {{ @query pnpm test 2>&1 | tail -1 }}
**Last commit:** {{ @query git log --oneline -1 }}

## Source Files

@list ./src/ match="**/*.ts" | sort | @render type="table" columns="name,size"

## Environment

@if env.NODE_ENV == "production"
Running in **production** mode.
@else
Running in **{{ env.NODE_ENV }}** mode.
@endif
```

Render it:

```bash
mai render status.md
```

Every directive runs. The output is clean Markdown with real data from your system - not values someone typed in last month.

---

## How It Works

Every MarkdownAI document starts with `@markdownai` on the first line (or the first line after YAML frontmatter). Everything after that is standard Markdown, extended with directives.

```
@markdownai
```

That one line changes everything. The `mai` tool reads your file, runs the MarkdownAI engine, and produces clean output. Directives become their results. Conditions are evaluated. Macros expand. Data sources are queried.

The toolchain has six components:

| Package | Role |
|---------|------|
| `@markdownai/parser` | Converts `.md` files to an AST - inert, no execution |
| `@markdownai/engine` | Walks the AST, runs directives, assembles output |
| `@markdownai/renderer` | Formats data into 11 output styles (table, bar chart, flow, etc.) |
| `@markdownai/mcp` | MCP server - serves live document execution to Claude and other AI tools |
| `@markdownai/core` | The `mai` binary and all CLI commands |
| `@markdownai/stripper` | Removes directives, producing plain Markdown |

---

## Language Features

### The @markdownai Header

```
@markdownai
@markdownai v1.0
@markdownai shell-inline="passthrough"
```

Every live document must begin with `@markdownai`. Optional options can follow on the same line:
- `v1.0` - pin to a specific specification version
- `shell-inline="passthrough"` - let Claude Code's native `!`command`` syntax pass through unmodified (see [Shell Inline Interception](#shell-inline-interception))

YAML frontmatter is transparent - `@markdownai` can appear as the first line after a `---...---` frontmatter block. This makes MarkdownAI documents fully compatible with Claude Code skill file format.

---

### Inline Interpolation {{ }}

Embed any expression directly into prose:

```markdown
This report was generated on {{ @date format="YYYY-MM-DD" }}.
There are {{ @query bash -c "find src -name '*.ts' | wc -l" }} TypeScript files.
The current user is {{ env.USER }}.
```

The `{{ }}` syntax works with:
- Environment variables: `{{ env.NODE_ENV }}`
- @query results: `{{ @query git branch --show-current }}`
- @date expressions: `{{ @date format="YYYY-MM-DD HH:mm" }}`
- Any expression supported by the engine's expression system

Unset variables evaluate to an empty string rather than an error. Use `{{ var ?? "default" }}` for explicit fallbacks.

---

### @env - Environment Variables

```
@env DATABASE_URL required
@env API_KEY required masked
@env REGION fallback=us-east-1
@env NODE_ENV fallback=development
```

Declare the environment variables your document depends on. `required` causes `mai validate` to fail if the variable is unset. `masked` prevents the value from appearing in rendered output (even in caching). `fallback=value` provides a default when the variable is absent.

Environment variables load in this priority order: system environment, then `--env` file, then `@import`ed fallbacks, then inline `@env` fallbacks, then empty string.

---

### @define and @call - Macros

Define reusable blocks once, call them anywhere:

```markdown
@define status-badge
Active: {{ env.SERVICE_STATUS }} | Region: {{ env.REGION }}
@end

## Service A
@call status-badge

## Service B
@call status-badge
```

Macros expand at call sites. They can contain any directives, conditional blocks, or data fetches. Define them in a shared file and `@import` them to share across documents.

Macros also accept parameters:

```markdown
@define file-check
@if file.exists "{{ path }}"
- {{ path }} exists
@else
- {{ path }} MISSING
@endif
@end

@call file-check path=./src/index.ts
@call file-check path=./dist/index.js
```

---

### @include - Content Inclusion

```
@include ./CHANGELOG.md
@include ./docs/api-reference.md lines=10-50
@include ./src/engine.ts lines=45-80
```

Pull content from another file directly into your document's output. `lines=N-M` includes only a specific range - useful for embedding relevant source code in documentation.

MarkdownAI tracks and prevents circular includes. The first-wins rule applies when multiple includes chain into each other.

---

### @import - Definition Import

```
@import ./shared/connections.md
@import ./shared/macros.md @cache session
@import ../config/env-defaults.md
```

Import definitions (macros, `@connect` settings, `@env` fallbacks) from another file. Unlike `@include`, `@import` pulls in only definitions - no content from the imported file appears in your output. This keeps your working documents clean while sharing a single source of truth for shared configuration.

Session caching on `@import` avoids re-parsing the same file on repeated runs.

---

### @if - Conditionals and Expression System

Show or hide sections based on any condition:

```markdown
@if env.APP_ENV == "production"
**Warning:** You are viewing live production data.
@elseif env.APP_ENV == "staging"
Staging environment - data may not reflect production.
@else
Development mode.
@endif
```

Check file existence:

```markdown
@if file.exists "./config/custom.json"
@include ./config/custom.json
@elseif file.isDir "./config"
Config directory found but no custom.json.
@endif
```

Combine conditions:

```markdown
@if env.ROLE == "admin" && env.REGION == "us-east"
Admin panel - US East
@endif

@if env.DEBUG != "" || env.VERBOSE == "true"
Debug output enabled.
@endif
```

The expression system supports: `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`, `startsWith`, `endsWith`, `includes`, `file.exists`, `file.isFile`, `file.isDir`, arithmetic, and string operations. The same operators work in `@if` conditions, `where` filters on data queries, and `{{ }}` interpolations.

---

### Pipe Operator and @render

Chain data through transformations before rendering:

```
@list ./src/ | sort | @render type="table"
@list ./packages.json path=$.dependencies | sort | @render type="list"
@query bash -c "git log --oneline -20" | grep "feat" | @render type="numbered"
```

Built-in transforms (cross-platform, no shell required):
- `sort` / `sort -n` / `sort -r` - alphabetical or numeric sort
- `grep <pattern>` / `grep -v` / `grep -i` - include or exclude matching lines
- `head -N` / `tail -N` - keep first or last N lines
- `uniq` - deduplicate consecutive lines
- `wc -l` - count lines

Shell-dependent transforms (Unix/WSL): `awk`, `sed`, `jq`, `cut`, and any other shell command.

The `@render` sink controls output format:

```
@render type="table" columns="name,version,description"
@render type="bar" label="package" value="size"
@render type="tree"
@render type="flow"
@render type="timeline"
@render type="json"
```

---

## Data Sources

### @list - Filesystem and Structured Data

List files, directories, or structured data from JSON/YAML:

```
@list ./src/ match="**/*.ts"
@list ./src/ type=dirs depth=2
@list ./package.json path=$.dependencies
@list ./config.yaml path=$.services mode=entries
@list ./data.csv where="status == active" columns="name,email"
```

Options:

| Option | Default | Description |
|--------|---------|-------------|
| `match` | `*` | Glob pattern for filtering files |
| `type` | `files` | `files`, `dirs`, or `both` |
| `depth` | unlimited | Directory depth to search |
| `path` | root | Dot-notation path into JSON/YAML |
| `mode` | - | `keys`, `values`, or `entries` for JSON objects |
| `columns` | all | Fields to include, with optional labels |
| `where` | - | Filter expression on row fields |
| `as` | - | Format shorthand: `table`, `list`, `numbered` |
| `@cache` | - | `session`, `persist`, or `ttl=N` |

---

### @read - Structured File Access

Read and extract values from structured files:

```
@read ./package.json path=$.version
@read ./.env key=DATABASE_URL
@read ./config.yaml path=$.server.port
@read ./data.csv column=email where="active == true"
@read ./config.toml path=$.database.host
```

Supported formats: JSON, YAML, TOML, `.env` (flat key-value), CSV. The `path` option uses dot-notation for JSON/YAML/TOML. The `key` option looks up a single value in `.env` files. `column` and `where` filter CSV data.

---

### @tree, @date, @count - Utility Directives

**Directory tree:**
```
@tree ./src depth=2
@tree ./packages depth=3 type=dirs
```

**Current date/time:**
```
@date format="YYYY-MM-DD"
@date format="YYYY-MM-DD HH:mm:ss"
@date format="MMMM D, YYYY"
```

**Count files matching a pattern:**
```
@count ./src "*.ts"
@count ./test "*.test.ts"
```

These utilities work in inline expressions too:

```markdown
Generated: {{ @date format="YYYY-MM-DD" }} | TypeScript files: {{ @count ./src "*.ts" }}
```

---

### @connect and @db - Database Queries

Register a database connection once, query it anywhere:

```
@connect mydb sqlite://./data.db
@connect prod postgresql://{{ env.DB_HOST }}/{{ env.DB_NAME }}
@connect mongo mongodb://{{ env.MONGO_URI }}/{{ env.MONGO_DB }}
```

Then query it:

```
@query mydb SELECT count(*) as total FROM orders WHERE status='active'
@query prod SELECT id, name, created_at FROM users ORDER BY created_at DESC LIMIT 10
```

Results pipe into `@render` for formatting. Supported databases: SQLite, PostgreSQL, MySQL/MariaDB, MongoDB.

All database access is jailed by default - see [Database Query Jail](#database-query-jail).

---

### @http - HTTP Requests

```
@http GET https://api.example.com/status
@http GET {{ env.API_ENDPOINT }}/health expected=200
@http POST {{ env.WEBHOOK_URL }} body={"event":"deploy"} headers={"Authorization":"Bearer {{ env.TOKEN }}"}
```

Options: `expected=<status>` to assert the response code, `body=<json>`, `headers=<json>`, and `@cache` to avoid hammering external APIs on repeated renders.

All HTTP access is jailed by default - see [HTTP Request Jail](#http-request-jail). Cloud metadata endpoints (169.254.169.254 and similar) are blocked by immutable rules that cannot be disabled by any configuration.

---

### @query - Shell Commands

```
@query git branch --show-current
@query bash -c "find src -name '*.ts' | wc -l"
@query bash -c "cat package.json | jq .version"
```

With named label (result stored for reuse in conditions and interpolations):

```
@query bash -c "git status --porcelain" label=dirty_files
@if {{ dirty_files }} != ""
Working tree is dirty.
@endif
```

Shell execution is disabled by default (`allowShell: false`). Enable it in your security config with an explicit allowlist of permitted command patterns. All executions are subject to deny patterns, jailRoot confinement, and optional audit logging.

---

### @phase, @on complete, and @graph

Structure a document into sequential phases:

```markdown
@phase pre-flight
@env DEPLOY_TOKEN required
@http GET {{ env.HEALTH_ENDPOINT }}/health expected=200

@on complete
  Proceeding to deploy phase.
@end

@phase deploy
@query bash -c "kubectl set image deployment/{{ env.APP_NAME }} {{ env.IMAGE_NAME }}:{{ env.TAG }}"

@on complete
  Deployment done. Running verification.
@end

@phase verify
@http GET {{ env.HEALTH_ENDPOINT }}/health expected=200 retries=5 delay=10s
@end
```

Phases let you write a document that is also a workflow. Use `mai render --phase verify` to jump to a specific phase, or run phases in sequence. The MCP server exposes `list_phases`, `resolve_phase`, and `next_phase` tools so AI tools can navigate the workflow programmatically.

`@graph` builds a dependency graph from frontmatter relationships:

```
@graph depends_on from=".mdd/docs/*.md" style=mermaid
```

---

## Security

Security is a first-class concern in MarkdownAI, not an afterthought. Every external operation is jailed by default and must be explicitly enabled.

### Security Config and Runtime Modes

Initialize a security policy for your project:

```bash
mai security init
mai security show
```

The security policy lives in `.markdownai/security.json`. Two runtime modes are available:
- `strict` - any unset security option defaults to the most restrictive behavior
- `permissive` - useful for development, relaxes defaults

All security policy changes can be audited with the built-in audit log.

---

### Filesystem Confinement

All file access (`@include`, `@read`, `@list`, `@tree`) is confined to a document root - by default, the directory containing the document being rendered. No directive can read files above this root using path traversal.

Content masking prevents sensitive values from appearing in rendered output. Any value matching your configured secret patterns (API keys, tokens, connection strings) is replaced with `[MASKED]` before it reaches the output.

---

### Shell Execution Jail

`@query` shell execution is disabled by default. Enable it with an allowlist:

```bash
mai security shell enable
mai security shell add "git *"
mai security shell add "find * -name *.ts"
```

Then configure:

| Option | Default | Description |
|--------|---------|-------------|
| `shell.enabled` | `false` | Master switch for `@query` execution |
| `shell.allow_patterns` | `[]` | Glob patterns for permitted commands |
| `shell.deny_patterns` | `[]` | Patterns always blocked (even if allowed) |
| `shell.allow_network` | `false` | Whether shell commands may make network calls |
| `shell.audit_log` | `true` | Record all execution attempts |

---

### Database Query Jail

Database access is read-only by default. Write operations, DDL statements, and full-table scans on large collections are blocked unless explicitly permitted.

```bash
mai security db add postgresql://localhost/mydb
mai security db allow-collection users
mai security db deny-keyword DROP
mai security db test "SELECT * FROM users"
```

| Option | Default | Description |
|--------|---------|-------------|
| `allowed_operations` | Read only | Query operations permitted |
| `denied_keywords` | None | SQL/query keywords to block |
| `allowed_collections` | All | Collections/tables that may be queried |
| `readonly` | `true` | Enforce strict read-only |
| `max_results` | `1000` | Maximum rows per query |

---

### HTTP Request Jail

HTTP access is disabled by default. Enable it with an explicit domain allowlist:

```bash
mai security http enable
mai security http add-domain api.example.com
mai security http add-domain "*.github.com"
```

| Option | Default | Description |
|--------|---------|-------------|
| `http.enabled` | `false` | Master switch for `@http` |
| `http.allowed_domains` | `[]` | Domains `@http` may contact |
| `http.denied_domains` | `[]` | Always-blocked domains |
| `http.allowed_methods` | `["GET"]` | HTTP methods permitted |
| `http.max_response_size` | 1 MB | Maximum response size |
| `http.timeout` | 10000 ms | Request timeout |

---

### Immutable Built-in Rules

Some rules are hardcoded and cannot be disabled by any configuration - not by security policy, not by environment variables, not by document directives. These are the rules the engine will always enforce regardless of what your config says:

- Cloud metadata endpoints are always blocked: `169.254.169.254`, `metadata.google.internal`, and all similar endpoints used for credential theft in cloud environments
- `path traversal` sequences (`../`) are always blocked in jailed contexts
- Documents that reach their maximum phase recursion depth are always halted
- Content masking always runs before caching - credentials can never be stored in plain text

These rules are implemented as frozen, readonly arrays in the engine code. They cannot be overridden.

---

## Caching

Add `@cache` to any directive to avoid redundant fetches on repeated renders:

```
@query bash -c "git log --oneline -100" @cache session
@http GET https://api.example.com/data @cache persist ttl=3600
@db SELECT count(*) FROM users @cache session ttl=300
@import ./shared/macros.md @cache session
@list ./node_modules/.bin/ @cache persist
```

Cache modes:

| Mode | Behavior |
|------|----------|
| `@cache session` | Store in memory for the current `mai` run |
| `@cache session ttl=N` | Session cache that expires after N seconds |
| `@cache persist` | Write to disk, survives restarts |
| `@cache persist ttl=N` | Disk cache with expiry |
| `@cache mock=./fixture.json` | Always return data from a local file - never call the live source |

The `mock` mode is valuable for testing: your document runs with real directives, but against predictable fixture data.

Clear caches:

```bash
mai cache clear              # clear everything
mai cache clear my-doc.md    # clear for one document
mai cache show               # inspect what is cached
mai cache seed my-doc.md     # pre-populate cache by running all fetches
```

---

## Output Formats

The renderer supports 11 output formats, all in plain ASCII that renders correctly everywhere:

| Format | Output |
|--------|--------|
| `list` | Unordered bullet list |
| `numbered` | Ordered numbered list |
| `links` | Clickable markdown links |
| `table` | Grid table with headers |
| `code` | Fenced code block |
| `inline` | Embedded scalar value |
| `bar` | Horizontal ASCII bar chart |
| `flow` | ASCII flow diagram with arrows |
| `tree` | Indented ASCII tree |
| `timeline` | Left-to-right ASCII timeline |
| `json` | Pretty-printed JSON |

Use in pipe chains:

```
@list ./src/ | sort | @render type="tree"
@query bash -c "df -h" | @render type="table"
@db SELECT name, revenue FROM sales | @render type="bar" label="name" value="revenue"
```

---

## Claude Code and AI Integration

MarkdownAI was designed with AI-native workflows in mind. Every feature is built to serve both humans reading rendered output and AI tools consuming live document context.

### MCP Server

```bash
mai serve
```

Starts an MCP (Model Context Protocol) server that exposes MarkdownAI document execution to Claude, Cursor, and any other MCP-compatible AI tool. Claude can query documents, execute directives, navigate phases, and get live data - without reading raw source files.

Available MCP tools:

| Tool | Description |
|------|-------------|
| `read_file` | Read and execute a MarkdownAI document, returning rendered output |
| `list_phases` | List all `@phase` blocks in a document with their status |
| `resolve_phase` | Check if a phase's preconditions are met |
| `next_phase` | Advance to the next phase in a sequence |
| `execute_directive` | Run a single directive and return the result |
| `get_constraints` | Return structured rules from the document |
| `call_macro` | Execute a named `@define` macro |
| `validate_document` | Check a document for errors without rendering |
| `cache_status` | Show cached entries for a document |

---

### PreToolUse Hook

```bash
mai init
```

Installs a PreToolUse hook into your AI client (Claude Code, Cursor). When the AI reads a `.md` file that starts with `@markdownai`, the hook intercepts the read and routes it through `mai render` first. The AI receives the rendered, executed output rather than raw directives.

This means your AI assistant always sees live data. When Claude reads your status doc, it sees the actual current branch, real test results, and live service status - not the last time someone manually updated the markdown.

---

### Skill Context Variables

When a MarkdownAI document is used as a Claude Code skill file (via the MCP `read_file` tool), the full slash command invocation context is available in `@if` conditions and `{{ }}` interpolations.

Available variables:

| Variable | Description |
|----------|-------------|
| `ARGUMENTS` or `args` | Full raw `$ARGUMENTS` string |
| `argsList` | Positional args, shell-style parsed |
| `arg0` `arg1` `arg2` `arg3` | Shorthand positionals |
| `CLAUDE_EFFORT` | `low`, `medium`, `high`, `xhigh`, or `max` |
| `CLAUDE_SESSION_ID` | Current Claude Code session ID |
| `CLAUDE_SKILL_DIR` | Directory containing the skill file |
| Named arg keys | From skill frontmatter `arguments:` list |

This enables genuine engine-evaluated dispatch in skill files:

```markdown
@markdownai

@if ARGUMENTS.startsWith("audit")
  @include ./audit-mode.md
@elseif ARGUMENTS.startsWith("build")
  @include ./build-mode.md
@elseif ARGUMENTS.startsWith("plan")
  @include ./plan-mode.md
@endif
```

The engine routes to the correct section before Claude even sees the file. The AI receives only the content relevant to the actual invocation.

Show more detail for high-effort sessions:

```markdown
@if CLAUDE_EFFORT == "max"
  @include ./extended-analysis.md
@endif
```

The preprocessor also handles `$ARGUMENTS`, `$ARGUMENTS[N]`, and `$N` shorthands, so existing Claude Code syntax works directly in expressions.

---

### Shell Inline Interception

Claude Code skill files support a native shell injection syntax: `` !`command` ``. It runs before Claude sees the file. No security gates.

In any `@markdownai` document, MarkdownAI intercepts this syntax and routes it through the same security layer as `@query`:

```markdown
Current branch: !`git branch --show-current`
Files changed: !`git diff --stat | wc -l`
```

With `allowShell: true` and no matching deny patterns, these execute and their output replaces the tags inline. With `allowShell: false` (default), they are blocked with a warning.

To opt out of interception and let Claude Code handle it natively:

```
@markdownai shell-inline="passthrough"
```

Security comparison:

| Control | `@query` | `` !`cmd` `` via MarkdownAI | `` !`cmd` `` via Claude Code |
|---------|----------|-----------------------------|------------------------------|
| Disabled by default | Yes | Yes | No - always runs |
| Command allowlist | Yes | Yes | No |
| Deny patterns | Yes | Yes | No |
| Filesystem jail | Yes | Yes | No |
| Immutable block rules | Yes | Yes | No |
| Audit log | Yes | Yes | No |
| Works in any document | Yes | Yes | No - skills only |
| Named output for reuse | Yes (`label=`) | No - inline only | No |

---

### AI-Native Features

MarkdownAI includes a set of features designed specifically for AI consumption:

**Consumer-targeted rendering:** Tag sections with `@consumer=ai` or `@consumer=human` to show different content to different audiences. The same document serves both a developer reading in a terminal and Claude processing it via MCP.

**@prompt - Embedded AI instructions:** Embed instructions for AI consumers directly in the document without them appearing in human-readable output. Use for context, constraints, and behavioral guidance.

**@constraint - Machine-readable rules:** Express rules as structured `@constraint` blocks that AI consumers can check programmatically, not just read and hope to remember.

**Token-efficient format mode:** `@consumer=ai` with format mode strips narrative prose and keeps only machine-actionable directives - reducing token consumption for AI consumers by up to 35% compared to the same document in human mode.

---

## CLI Reference

All commands share these universal flags:

| Flag | Description |
|------|-------------|
| `--env <file>` | Load a `.env` file for environment variables |
| `--cwd <path>` | Run as if in a different directory |
| `--verbose` | Show warnings in output |
| `--strict` | Treat warnings as errors |
| `--silent` | Suppress all output except fatal errors and security alerts |

Full command list:

| Command | Description |
|---------|-------------|
| `mai render <file>` | Execute and print rendered markdown to stdout |
| `mai render <file> -o <path>` | Execute and write result to a file |
| `mai validate <file>` | Check for errors and warnings; exits 1 on error |
| `mai parse <file>` | Output the document AST as JSON |
| `mai parse <file> --node <type> --pretty` | Filter and format AST output |
| `mai eval "<expression>"` | Evaluate a single expression against the environment |
| `mai strip <file>` | Remove all directives; output plain Markdown |
| `mai serve` | Start the MCP server |
| `mai init` | Install the PreToolUse hook into your AI client |
| `mai build <file> -o <output>` | Render and write to disk (alias for render -o) |
| `mai watch <file> -o <output>` | Watch for changes and re-render automatically |
| `mai list-imports <file>` | Show the full @import dependency tree |
| `mai list-macros <file>` | List all @define macros used in a document |
| `mai list-phases <file>` | List all @phase blocks with their transitions |
| `mai cache clear [file]` | Clear cache for one document or all |
| `mai cache show [file]` | Inspect cache entries |
| `mai cache seed <file>` | Pre-populate cache by running all fetches |
| `mai security init` | Create or import a security policy |
| `mai security show` | Display the active security policy |
| `mai security shell enable` | Enable shell command execution |
| `mai security shell add <pattern>` | Add a command to the allowlist |
| `mai security shell remove <pattern>` | Remove a pattern from the allowlist |
| `mai security shell list` | List all shell security rules |
| `mai security shell test "<command>"` | Test whether a command would be permitted |
| `mai security http enable` | Enable HTTP requests |
| `mai security http add-domain <domain>` | Add a domain to the allowlist |
| `mai security http remove-domain <domain>` | Remove a domain |
| `mai security db add <connection>` | Register a database connection |
| `mai security db set <option> <value>` | Set a database jail option |
| `mai security db allow-collection <name>` | Allow a specific collection or table |
| `mai security db deny-keyword <word>` | Block a SQL keyword |
| `mai security db test "<query>"` | Test whether a query would be permitted |
| `mai test --suite=ai` | Run the AI-native end-to-end test suite |

---

## Directive Reference

Every directive supported by MarkdownAI, in one place.

### Header and Activation

| Directive | Description |
|-----------|-------------|
| `@markdownai` | Activate MarkdownAI processing. Must be on line 1 (or first line after YAML frontmatter). |
| `@markdownai v1.0` | Pin to a specific specification version. |
| `@markdownai shell-inline="passthrough"` | Let Claude Code's `!`cmd`` syntax pass through unintercepted. |

### Environment and Variables

| Directive | Description |
|-----------|-------------|
| `@env VAR required` | Declare a required variable. `mai validate` fails if unset. |
| `@env VAR required masked` | Required + suppress from output even if present. |
| `@env VAR fallback=value` | Declare a default when variable is not set. |
| `{{ env.VAR }}` | Inline interpolation of any environment variable. |
| `{{ var ?? "default" }}` | Interpolation with explicit fallback. |

### Macros and Composition

| Directive | Description |
|-----------|-------------|
| `@define name` ... `@end` | Define a reusable macro block. |
| `@call name` | Expand a macro at this location. |
| `@call name param=value` | Expand a macro with named parameters. |
| `@include ./path.md` | Include another file's content verbatim. |
| `@include ./file.ts lines=N-M` | Include specific line range. |
| `@import ./path.md` | Import definitions (macros, connections, env defaults) from another file. |
| `@import ./path.md @cache session` | Import with session caching. |

### Conditionals

| Directive | Description |
|-----------|-------------|
| `@if <expr>` | Include content if expression is true. |
| `@elseif <expr>` | Alternate branch. |
| `@else` | Fallback branch. |
| `@endif` | Close conditional block. |

Condition operators: `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `\|\|`, `!`, `startsWith`, `endsWith`, `includes`, `file.exists`, `file.isFile`, `file.isDir`

### Data Sources

| Directive | Description |
|-----------|-------------|
| `@list <path>` | List filesystem entries or structured data from JSON/YAML/CSV. |
| `@read <path>` | Read and extract a value from a structured file. |
| `@tree <path>` | Render a directory tree. |
| `@date format="..."` | Current date/time in any format. |
| `@count <path> "<pattern>"` | Count files matching a pattern. |
| `@connect <name> <dsn>` | Register a named database connection. |
| `@query <name> <sql>` | Execute a database query against a named connection. |
| `@query <command>` | Execute a shell command and use its stdout. |
| `@query <command> label=name` | Execute and store result in named label for reuse. |
| `@http <METHOD> <url>` | Make an HTTP request and use the response body. |
| `@http <METHOD> <url> expected=<code>` | Assert response status code. |

### Pipeline and Rendering

| Directive | Description |
|-----------|-------------|
| `\| sort` | Sort lines alphabetically. |
| `\| sort -n` | Sort numerically. |
| `\| sort -r` | Sort reverse. |
| `\| grep <pattern>` | Keep matching lines. |
| `\| grep -v <pattern>` | Remove matching lines. |
| `\| grep -i <pattern>` | Case-insensitive match. |
| `\| head -N` | Keep first N lines. |
| `\| tail -N` | Keep last N lines. |
| `\| uniq` | Deduplicate consecutive lines. |
| `\| wc -l` | Count lines. |
| `@render type="<format>"` | Render accumulated pipeline result. |

### Phases and Graphs

| Directive | Description |
|-----------|-------------|
| `@phase <name>` | Open a named phase block. |
| `@on complete` ... `@end` | Actions to take when a phase completes. |
| `@graph` | Build a dependency graph from document relationships. |

### Caching

| Directive | Description |
|-----------|-------------|
| `@cache session` | Cache result in memory for the current run. |
| `@cache session ttl=N` | Session cache, expires after N seconds. |
| `@cache persist` | Cache result to disk across runs. |
| `@cache persist ttl=N` | Disk cache with expiry. |
| `@cache mock=./file.json` | Always use fixture file, never call live source. |

### AI-Native

| Directive | Description |
|-----------|-------------|
| `@consumer=ai` | Tag a block for AI consumers only. |
| `@consumer=human` | Tag a block for human readers only. |
| `@prompt` ... `@end` | Embed instructions for AI consumers (not in human output). |
| `@constraint <name>` ... `@end` | Declare a machine-readable rule. |

---

## MDD Integration

MarkdownAI was built so MDD (Manual-Driven Development) could use it. MDD is a workflow that enforces "document first" development — every feature is written down before any code is written. MarkdownAI makes those documents live.

**The problem MDD has:** every artifact in the `.mdd/` directory is static Markdown. The session context, the dependency graph, the audit reports — they're all accurate when written and stale five minutes later.

**The solution:** add `@markdownai` to MDD artifacts and they stop being records of the past. They become live queries of the present.

`.mdd/.startup.md` with a `@markdownai` header queries git, counts feature docs by status, and reads the last audit on every render. A pre-session hook runs `mai render` before Claude Code invokes. Claude always enters the session with accurate project state — real branch, real feature counts, real last audit findings — not whatever the file said last Tuesday.

`.mdd/connections.md` (the dependency graph and Mermaid diagram) becomes `mai render connections.md`. No more "rebuild connections" step. Add `mai validate connections.md` to CI and broken `depends_on` references surface automatically.

Ops runbooks with `@phase` blocks become self-validating procedures. Pre-flight failures stop before deployment. Health checks show actual HTTP response codes, not just "check if it's up."

The quantitative case is compelling too. Current MDD sessions consume approximately 10,234 tokens for the router plus active mode file plus startup context. Converting to MarkdownAI directives with macro deduplication and conditional rendering brings that to roughly 6,600-8,600 tokens — a 64-84% reduction in full optimization. For AI-heavy workflows where context window matters, that difference is real.

The philosophical payoff: MDD enforces "document first." MarkdownAI enforces "documentation that cannot lie." Applied to MDD's own artifacts, the two tools together mean the workflow itself is managed by its own principles.

---

## Installation

```bash
npm install -g @markdownai/core
```

Verify:

```bash
mai --version
mai validate --help
```

Install the PreToolUse hook for your AI client:

```bash
mai init
```

Initialize a security policy for your project:

```bash
cd your-project
mai security init
```

Node.js 18 or higher required. Works on macOS, Linux, and Windows (WSL recommended for shell command features).

---

## Architecture

MarkdownAI is a six-package npm workspaces monorepo, all in TypeScript with strict mode throughout.

```
packages/
  parser/     @markdownai/parser    - AST production only, no execution
  renderer/   @markdownai/renderer  - 11 format modules, ASCII output
  engine/     @markdownai/engine    - execution, env resolution, pipe, cache
  mcp/        @markdownai/mcp       - MCP server, 9 phase tools
  core/       @markdownai/core      - mai binary, all CLI commands
```

The parser is intentionally inert - it never executes anything. This separation means you can parse any document safely in any environment. The engine runs directives. The renderer formats output. The MCP server serves live context to AI tools. The core binary wires them together and exposes the CLI.

Security enforcement happens in the engine, not in individual directives. The security layer sits between the engine's directive runner and any external system. This means security gates apply regardless of which directive triggers the operation.

689 tests across all packages. The test suite includes unit tests for every directive, E2E tests for the full CLI pipeline, MCP protocol conformance tests, and a dedicated AI-native feature test suite.

---

## License

MIT

---

<p align="center">
  <strong>documentation that cannot lie.</strong>
</p>
