<p align="center">
  <img src="docs/markdownAI_hero.webp" alt="MarkdownAI - Documentation That Cannot Lie" width="100%" />
</p>

# MarkdownAI

> **documentation that cannot lie.**

<p align="center">
  <a href="https://markdownai.dev">
    <img src="https://img.shields.io/badge/📖_Documentation-markdownai.dev-0891b2?style=for-the-badge&labelColor=08090f" alt="Documentation Site" />
  </a>
  &nbsp;
  <a href="https://markdownai.dev/user-guide.html">
    <img src="https://img.shields.io/badge/📚_User_Guide-Full_Reference-059669?style=for-the-badge&labelColor=08090f" alt="User Guide" />
  </a>
</p>

<p align="center">
  <a href="#quick-start">
    <img src="https://img.shields.io/badge/Quick_Start-Get_running_in_60s-0891b2?style=for-the-badge&labelColor=1e293b" alt="Quick Start" />
  </a>
  &nbsp;
  <a href="#directive-reference">
    <img src="https://img.shields.io/badge/Directives-Full_Reference-059669?style=for-the-badge&labelColor=1e293b" alt="Directive Reference" />
  </a>
  &nbsp;
  <a href=".mdd/manual/manual.md">
    <img src="https://img.shields.io/badge/User_Manual-90_features-7c3aed?style=for-the-badge&labelColor=1e293b" alt="User Manual" />
  </a>
</p>

[![npm](https://img.shields.io/badge/npm-%40markdownai%2Fmarkdownai-red)](https://www.npmjs.com/package/@markdownai/markdownai)
[![VS Code](https://img.shields.io/badge/VS_Code-Marketplace-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=markdownai.markdownai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Tests: 811](https://img.shields.io/badge/tests-811_passing-brightgreen)](./packages)

---

## What is MarkdownAI

A Reddit commenter looked at this and said: "I mean I get it but you've basically made jinja/handlebars/eex with a lil flava."

This is a reasonable first impression and a completely wrong conclusion.

Jinja, Handlebars, and EEx are template engines. You write a template with `{{ user.name }}`, run a build step, and get an HTML file. The template is gone. The output goes to a browser. That's the whole job.

MarkdownAI is different in every dimension that matters:

**The consumer is an AI, not a browser.** Jinja renders for browsers that display HTML. MarkdownAI renders for Claude, which reads Markdown. The design decisions follow from that. A browser needs bytes fast. Claude needs accurate facts and focused context - it doesn't benefit from stale data delivered quickly.

**It runs at read time, not build time.** Template engines run when you deploy. MarkdownAI runs when Claude opens the file. That means every `@query`, `@env`, `@http`, and `@db` directive resolves against the real current state of your system - not the state from your last build. The document doesn't store values. It fetches them.

**The MCP server does the computation so Claude doesn't have to.** This is the part that actually matters. When Claude reads a MarkdownAI document through the MCP integration, every directive resolves in the server layer before Claude sees any content. The `@if` conditions have already been evaluated. The database queries have already run. The environment variables have already been substituted. Claude receives resolved facts - not a list of conditions it needs to think through. It can immediately focus on what it's actually there to do: write code, answer questions, follow a workflow.

Without MarkdownAI, Claude hits a doc and has to figure out what's true. It stops to run a shell command. It stops again to check an env var. It stops again to verify a condition. Each stop costs context and interrupts the actual work. With MarkdownAI, those interruptions don't happen. The document arrives pre-resolved.

Something nobody talks about: every time Claude stops to check an environment variable, verify a file exists, confirm a port is open -- that's roughly 2 seconds gone. Tool call out, wait, result back, Claude re-orients, continues.

In a real workflow that's not 1 check. It's 15. That's 30 seconds of dead time and 15 context interruptions where Claude has to re-establish where it was.

MarkdownAI's MCP layer does all of that before Claude touches the session. Environment is pre-validated, state is pre-loaded, constraints are already in context. Claude reads phase 1 and immediately works.

No stops. No re-orientation. No context bloat from housekeeping that a script could handle in milliseconds.

The difference between a prompt engineer's workflow and a production workflow is exactly this. Prompt people write the instructions. Production people eliminate every unnecessary thing Claude has to do before writing the instructions.

**Phases are not template partials.** The `@phase` directive is where the comparison to template engines fully breaks down.

A MarkdownAI phase is a named, lazy-loaded chunk of a workflow document. A 20-phase runbook doesn't load all 20 phases into Claude's context at once - the MCP server serves one phase at a time. Claude reads phase 1, works through it, then calls `next_phase` to advance. The server returns phase 2. Claude never holds the full workflow in context. The document manages state. Claude follows steps.

This means a complex deployment runbook, a multi-step debugging workflow, or a long onboarding sequence can be arbitrarily large without ever flooding the AI's context window. Each phase is self-contained, each transition is explicit, and Claude never has to juggle what's relevant now versus what comes later.

Template engines have no concept of this because browsers don't have context windows.

**The actual difference:** Template engines make static output. MarkdownAI makes live context - context where the computation already happened, where the workflow is managed for you, and where the AI can work instead of gather.

---

## The Problem With Documentation

Here is something that happens at every company, every team, every project: someone writes great documentation. It is accurate. It is detailed. It is helpful.

Then the code changes.

The database schema gets a new field. The API endpoint moves. The environment variable gets renamed. The service goes from port 3000 to 8080. But the docs stay exactly as they were - frozen at the moment someone last had time to update them. Within weeks, the documentation is wrong. Within months, it actively misleads. People stop trusting it. Eventually, they stop reading it.

This is not a process failure. This is physics. Static text cannot track a moving system.

**MarkdownAI is the solution.** Add `@markdownai` to the first line of any `.md` file (or the first line after YAML frontmatter), and it becomes a live document. Instead of writing values that will go stale, you write directives that fetch the current value every time the document is rendered. Your database record count is queried when someone reads the doc, not when you wrote it. Your API response is real. Your environment variables are live. Your file tree reflects what's actually on disk right now.

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
  - [@switch - Multi-Branch Conditional](#switch---multi-branch-conditional)
  - [Pipe Operator and @render](#pipe-operator-and-render)
- [Data Sources](#data-sources)
  - [@list - Filesystem and Structured Data](#list---filesystem-and-structured-data)
  - [@read - Structured File Access](#read---structured-file-access)
  - [@tree, @date, @count - Utility Directives](#tree-date-count---utility-directives)
  - [@connect and @db - Database Queries](#connect-and-db---database-queries)
  - [@http - HTTP Requests](#http---http-requests)
  - [@query - Shell Commands](#query---shell-commands)
  - [@phase, @on complete, and @graph](#phase-on-complete-and-graph)
  - [@event - Event Broadcast](#event---event-broadcast)
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
- [VS Code Extension](#vs-code-extension)
- [Installation](#installation)
- [Architecture](#architecture)
- [User Manual](.mdd/manual/manual.md)

---

## What's New in v1.0

- **Iteration and variables:** `@foreach` walks list sources, `@set` binds values for reuse.
- **Filesystem writes:** `@mkdir`, `@copy`, `@append-if-missing`, `@update-frontmatter`, `@render-template` behind a `write_enabled` security gate.
- **Execution:** `@test` and `@check` inline the full runner output and expose exit code + recognized summary as separate labels.
- **Targeted reads:** `@read-frontmatter` for a single YAML field; `@hash` for content hashing with optional line-exclude regex.
- **`@if` content helpers:** `file.containsLine`, `file.containsSection`, `file.frontmatterField`.
- **Path jail split:** independent `source_root`, `data_root`, and `write_root` boundaries. Data ops now default to `cwd` instead of the document's directory. **Breaking change** - set `filesystem.data_root = "auto"` to restore the 0.x behavior.
- **SessionStart hook:** `mai init` installs a hook that renders `<project>/CLAUDE-MarkdownAI.md` and injects the output into every Claude Code session as live context. `CLAUDE.md` is never touched.
- **Ironclad PreToolUse hook:** detects MarkdownAI documents behind YAML frontmatter (Claude Code slash commands). The redirect message now ships the full MCP tool catalogue inline.
- **Skill rendering flags:** `mai render --skill-args`, `--skill-dir`, `--skill-effort`, `--skill-session-id` for testing skill files locally with full context.

See `changed.md` for the complete change log.

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
| `markdownai` (VS Code) | VS Code extension - language detection, syntax highlighting, snippets, completions, hover, go-to-definition, diagnostics |

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

**Dynamic paths** - embed `{{ expression }}` segments anywhere in the file path. The expression runs in the same sandbox as `@if` conditions, so `ARGUMENTS`, `arg0`, `env.*`, and any `@foreach` loop variable are all available:

```markdown
@include ./{{arg0}}-mode.md

@include ./{{arg0 || 'default'}}-section.md
```

Inside a `@foreach`, the loop variable works directly in the path:

```markdown
@foreach doc in @list ./docs/ match="*.md"
  @include ./templates/{{doc}}-layout.md
@end
```

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

v1.0 adds three content-aware helpers:

```markdown
@if file.containsLine "./README.md" ".*\[CRITICAL\].*"
  Critical items present - block the release.
@endif

@if file.containsSection "./doc.md" "## Bugs"
  Known-bugs section exists.
@endif

@if file.frontmatterField ".mdd/docs/01-mdd.md" "status" == "complete"
  This doc is shipped.
@endif
```

`containsLine` is a multiline regex test against the whole file. `containsSection` matches an ATX heading on its own line - pass `#`s to require a specific level. `frontmatterField` returns the scalar value of a YAML frontmatter key, or empty string if missing.

---

### @switch - Multi-Branch Conditional

When you have more than two or three branches, `@switch` is cleaner than a chain of `@if`/`@elseif`:

```markdown
@switch {{argsList[0]}}
  @case "build"
    Running build mode...
  @case "audit"
    Running audit mode...
  @case "status"
    Running status check...
  @default
    Unknown command. Try: build, audit, status.
@endswitch
```

Both the switch expression and each `@case` value support `{{ }}` dynamic expressions - the same sandbox as `@if`, so env vars, `argsList`, `arg0`, foreach loop variables, and all other context values work:

```markdown
@switch {{env.APP_ENV}}
  @case "production"
    Live data - changes are permanent.
  @case {{env.STAGING_LABEL}}
    Staging environment.
  @default
    Development mode.
@endswitch
```

Rules:
- First matching case wins - no fall-through
- `@default` is optional; if absent and nothing matches, the block produces empty output
- `@case "default"` matches the string `"default"` - it does NOT trigger the `@default` block
- Nesting works: `@switch` inside `@foreach`, `@if`, or another `@switch`
- Closes with `@endswitch`

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
@read ./config.yaml path=$.server.port
@read ./data.csv column=email where="active == true"
@read ./config.toml path=$.database.host
```

Supported formats: JSON, YAML, TOML, CSV. (`.env` files are blocked by built-in security rules to prevent credential exposure.) The `path` option uses dot-notation for JSON/YAML/TOML. `column` and `where` filter CSV data.

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
@date format="hh:mm A zzz"
@date format="ISO"
```

Available tokens:

| Token | Output |
|-------|--------|
| `YYYY` | Full year (2026) |
| `MM` | Month, zero-padded (01-12) |
| `DD` | Day, zero-padded (01-31) |
| `HH` | Hour, 24h zero-padded (00-23) |
| `hh` | Hour, 12h zero-padded (01-12) |
| `h` | Hour, 12h no padding (1-12) |
| `mm` | Minutes, zero-padded |
| `ss` | Seconds, zero-padded |
| `A` | AM or PM |
| `a` | am or pm |
| `zzz` / `z` | Timezone abbreviation (UTC, EST) |
| `Z` | UTC offset (+HH:mm) |
| `ZZ` | UTC offset compact (+HHmm) |
| `X` | Unix timestamp in seconds |
| `x` | Unix timestamp in milliseconds |
| `ISO` | Full ISO 8601 string |
| `date` | Shorthand for YYYY-MM-DD |

File modified time:
```
@date file="./CHANGELOG.md" type="modified" format="YYYY-MM-DD"
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

Register a database connection, then query it using MarkdownAI's built-in query language:

```
@connect primary type="postgres" uri=env.POSTGRES_URI
@connect analytics type="mongodb" uri=env.MONGO_URI
@connect local type="sqlite" uri=env.SQLITE_PATH
```

Then query:

```
@db using="primary" find="users" where="active==true" limit=10 columns="name:Name,email:Email"
@db using="analytics" count="events" where="type==pageview"
@db using="primary" one="orders" where="id==env.ORDER_ID"
@db using="analytics" aggregate="sales" group="region" sum="revenue" | @render type="bar"
```

The query language is database-agnostic - a document querying Postgres looks identical to one querying MongoDB. If you need joins, subqueries, or anything the query language does not cover, use `raw`:

```
@db using="primary" raw="SELECT u.name, COUNT(o.id) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.id"
```

Results pipe into `@render` for formatting. Supported databases: SQLite, PostgreSQL, MySQL/MariaDB, MSSQL, MongoDB.

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


### @foreach and @set - Iteration and Value Binding (v1.0+)

Two directives that let a document act like a small program. `@foreach` walks a list source and renders its body once per item. `@set` binds a value to a name you can use everywhere downstream.

```markdown
@markdownai v1.0

# Per-feature status

@foreach doc in @list ./.mdd/docs/ match="*.md"
  @read-frontmatter path="{{ doc }}" field="status" label=status
  - {{ doc }}: {{ status }}
@end

# Bind a value once, use it many times

@set today = @date format="YYYY-MM-DD"
@set release_branch = "release/{{ today }}"

Cutting branch {{ release_branch }} for the {{ today }} release.
```

**`@foreach` source expressions:**
- A directive that returns lines (`@list`, `@read`, `@tree`).
- A list-typed frontmatter field via `@read-frontmatter` (comma-joined; each item iterates).
- A `{{ label }}` interpolation that resolves to multi-line text.
- A comma-separated literal: `"alpha,beta,gamma"`.

Each iteration binds the loop variable so nested directives see `{{ var }}` substituted into their arguments before they fire. The binding is removed when the loop ends.

**`@set` right-hand sides:**
- Literal: `@set status = "active"`.
- Directive result: `@set today = @date format="YYYY-MM-DD"`.
- Interpolated string: `@set greeting = "Hello {{ name }}"`.

`@set` and `@foreach` shadow each other lexically. Inside a `@foreach` loop the loop variable wins over any outer `@set` of the same name; the outer binding is restored after the loop.

---

### @read-frontmatter and @hash - Targeted Reads (v1.0+)

Two read directives for cases where `@read` returns too much. `@read-frontmatter` pulls a single YAML field out of a document. `@hash` computes a content hash for change detection or doc-integrity checks.

```markdown
@markdownai v1.0

@read-frontmatter path=".mdd/docs/01-mdd.md" field="status" label=mdd_status
The mdd doc is currently: {{ mdd_status }}.

@hash path=".mdd/docs/01-mdd.md" algo=sha256 length=8 label=mdd_hash
Doc fingerprint: {{ mdd_hash }}.

@hash path="CHANGELOG.md" algo=sha256 exclude-line="^date:" label=changelog_hash
```

**`@read-frontmatter`** returns the trimmed scalar value. YAML lists are returned comma-joined (use with `@foreach` to walk them). Missing fields return an empty string with no warning.

**`@hash` options:**

| Option | Effect |
|--------|--------|
| `path` | File to hash. Resolves against `data_root`. |
| `algo` | Any Node `crypto.createHash` algorithm. Defaults to `sha256`. |
| `length` | Truncate the hex digest to N characters. |
| `exclude-line` | Regex. Lines matching this pattern are stripped before hashing. Useful for excluding self-referential fields like `hash:` in frontmatter. |
| `label` | Save the digest in a label for downstream use. |

---

### @test and @check - Execution (v1.0+)

`@test` runs the project test suite. `@check` runs typecheck, lint, or build. Both inline the runner's full combined output where the directive sits and expose three labels: `label` (full text), `label_exit` (exit code), and `label_summary` (one-line summary recognized from known runners).

```markdown
@markdownai v1.0

# Test results

@test command="pnpm test" label=test_results

@if {{ test_results_exit }} == "0"
All tests pass.
@else
Failures detected. See output above.
@endif

# Typecheck and lint

@check command="tsc --noEmit" label=typecheck
@check command="eslint ." label=lint
```

Auto-detection runs when `command=` is omitted. `@test` reads `scripts.test` from `package.json`. `@check` tries `typecheck`, `check`, `lint`, then `build` in that order.

The shell allowlist still applies - the command must match `shell.allow_patterns` in your security config. Both directives have a five-minute timeout.

> **Note:** Earlier 0.x betas truncated `@test` / `@check` output to a tail or a one-liner. v1.0 returns the complete runner output verbatim. The old `label_output` variable is gone; `label` now holds the full text. The `label_summary` variable is additive only - empty string when the runner output isn't recognized.

---

### Write Directives (v1.0+)

Five directives that mutate the filesystem from inside a document. All five obey `filesystem.write_enabled` (off by default) and respect `write_root` plus `allowed_write_paths`. Immutable always-block rules (`.env`, `**/.ssh/**`, `*credentials*`, etc.) still apply.

```markdown
@markdownai v1.0

# Bootstrap a project area

@mkdir .mdd
@mkdir .mdd/docs recursive=true
@copy from="./templates/mdd.md" to=".mdd/mdd.md" if-missing
@append-if-missing path=".gitignore" text=".mdd/audits/"

# Update one field in a doc

@update-frontmatter path=".mdd/docs/01-mdd.md" field="status" value="complete"
@update-frontmatter path=".mdd/docs/01-mdd.md" field="tags[append]" value="shipped"

# Generate a test file from a template

@render-template from="./templates/unit.test.ts.template" to="tests/unit/auth.test.ts"
  feature_name=auth
  has_endpoints=true
@end
```

**`@mkdir`** creates a directory. Recursive by default - pass `recursive=false` to require the parent to already exist.

**`@copy`** copies a file. `from=` resolves against `data_root`; `to=` against `write_root`. Parent directories of `to=` are created automatically. Pass `if-missing` to make it idempotent (skip if destination exists). This is the common pattern for bootstrap files that should be created once and never overwritten.

**`@append-if-missing`** appends a line to a file only if the text isn't already there. No-op if the file is absent. Use it for `.gitignore`, `.env.example`, and other config files that need to grow without duplicating entries.

**`@update-frontmatter`** sets a single YAML frontmatter field. The doc body is untouched. Supports nested paths and list addressing:

| Field syntax | Effect |
|--------------|--------|
| `status` | Set a top-level scalar. |
| `tags[append]` | Append to a YAML list. Creates the list if absent. |
| `tags[1]` | Set the second item of a block-style list (0-indexed). Out-of-range index logs a warning. |
| `satisfies[0].status` | Set a sub-field of the first element in a list of objects. |

List indexing requires block-list YAML (one item per line, `-` prefixed). Inline list mutation is only supported via `[append]`.

**`@render-template`** is a block directive. It reads a template file, substitutes `{{ key }}` placeholders with the parameters supplied between `@render-template` and `@end`, and writes the result to `to=`. Idempotent by default - pass `force` to overwrite. The template can be plain text with `{{ }}` placeholders or a full MarkdownAI document with its own directives. The template path resolves against `data_root`; the output path against `write_root`.

---

### @event - Event Broadcast

Fire a named signal with a payload to one or more transports while a document renders:

```markdown
@markdownai v1.0

// Plain string - fine for simple status
@event name='phase-start' data='setup' transport='log'

// JSON payload - use when you need multiple fields
@event name='progress' data='{"step": 2, "total": 5, "label": "Loading config"}' transport='vscode,log'

// Show inline in the document output as well
@event name='build-complete' data='{"status": "ok", "elapsed": "4s"}' transport='mcp' visible
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | Event name - identifies what happened (e.g. `phase-complete`, `progress`) |
| `data` | yes | The payload. Plain string or JSON object string. JSON is recommended for multiple fields. |
| `transport` | no | Comma-separated transport names. Defaults to `log` if omitted. |
| `visible` | no | Flag (no value). Renders a blockquote in document output alongside the transport dispatch. |

**Built-in transports:**

| Transport | Delivery | Output |
|-----------|----------|--------|
| `mcp` | Synchronous | Pushed to `EngineResult.events[]` before `execute()` returns |
| `log` | Fire-and-forget | Structured line to stderr: `[event] name=... data=... ts=...` |
| `vscode` | Fire-and-forget | JSON-Lines to `/tmp/markdownai-events-<sessionId>.json` - VS Code extension reads this for status bar display |
| `websocket` | Fire-and-forget | JSON payload broadcast to all connected WebSocket clients |
| `file` | Fire-and-forget | JSON-Lines appended to a configured file path |
| `http` | Fire-and-forget | JSON POST to a configured URL (domain must be in the allowlist) |
| `db` | Fire-and-forget | Insert into a configured collection (security jailed) |

All non-`mcp` transports run in a worker thread. Network latency, file I/O, and database writes are invisible to rendering time.

**Security:** all transports are blocked by default. Enable specific ones in `.markdownai/security.json`:

```json
{
  "events": {
    "allowed_transports": ["mcp", "log", "vscode"],
    "allow_env_interpolation": false,
    "max_value_length": 500,
    "onError": "silence"
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `allowed_transports` | `[]` | Transports that are permitted. Empty means all events are silently dropped. |
| `allow_env_interpolation` | `false` | When false, `{{ env.VAR }}` in `data` is dispatched literally. |
| `max_value_length` | `500` | Data is truncated to this length (hard cap, never configurable above 500). |
| `onError` | `"silence"` | `"silence"` drops blocked events silently, `"warn"` adds to warnings, `"fail"` surfaces an error. |

Masking runs unconditionally on `data` before any dispatch - a secret in a JSON value is caught and replaced with `***MASKED***`. `{{ expression }}` in `data` is only evaluated when `allow_env_interpolation: true`.

**Automatic debug metadata:** every event carries an automatic `meta` object with no author configuration needed:

```typescript
interface EventMeta {
  datetime: string          // ISO 8601 timestamp
  line: number              // line number of @event in the source file
  runId: string             // UUID for this execute() call
  sessionId: string | null  // MCP session ID, or null
  model: string | null      // AI model name (injected by the calling layer)
  tokenUsage: number | null // token count at dispatch time
  git: { hash: string; short: string } | null  // git commit at execute() start
  callstack: string[]       // active @phase and @call context
}
```

**Consuming events** (for the `mcp` transport):

```typescript
const result = await execute(ast, ctx)
for (const event of result.events) {
  console.log(event.name, event.data, event.meta.datetime)
}
```

**Rules:**
- All transports are blocked by default - add them to `allowed_transports` to enable.
- Masking is unconditional - runs on every event regardless of other settings.
- Data is hard-capped at 500 characters after masking.
- Multiple transports in a single `@event` fire simultaneously.
- `@event` inside `@phase` blocks fires at the point in execution where it appears.
- `mai strip` removes `@event` lines from output entirely.

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

v1.0 splits the single path jail into three independent boundaries. Each directive type uses its own jail so a skill file installed at `~/.claude/commands/<name>.md` can read sibling templates (source ops) while still reaching into the user's project (data ops). Before v1.0 these were one jail rooted at the document directory, which made skill-file workflows impossible.

| Jail | Used by | Default |
|------|---------|---------|
| `source_root` | `@import`, `@include` | `"auto"` - directory of the entry document |
| `data_root` | `@list`, `@read`, `@tree`, `@count`, `@date file=`, `@read-frontmatter`, `@hash`, `file.exists` / `isFile` / `isDir` / `containsLine` / `containsSection` / `frontmatterField`, `@copy from=`, `@test` / `@check` working dir | `"cwd"` - process working directory |
| `write_root` | `@mkdir`, `@copy to=`, `@append-if-missing`, `@update-frontmatter`, `@render-template to=` | `"cwd"` |

Each jail can be `"auto"` (document dir), `"cwd"` (process working dir), or an absolute path. Each has a companion allowlist of glob patterns (`allowed_source_paths`, `allowed_data_paths`, `allowed_write_paths`) that loosen the boundary. Patterns support `${VAR}` expansion against `HOME`, `CLAUDE_SKILL_DIR`, `CLAUDE_SESSION_ID`, and process env vars. Unset variables expand to empty string (fail-closed).

```json
{
  "filesystem": {
    "source_root": "auto",
    "data_root": "cwd",
    "allowed_source_paths": [
      "${CLAUDE_SKILL_DIR}/templates/**"
    ],
    "allowed_data_paths": [
      "${HOME}/.mdd/**"
    ],

    "write_enabled": false,
    "write_root": "cwd",
    "allowed_write_paths": [
      "${HOME}/.mai-out/**"
    ]
  }
}
```

Content masking prevents sensitive values (API keys, tokens, connection strings) from reaching rendered output. Matching values are replaced with `[MASKED]`. Masking runs before caching - secrets never enter the cache in plain text.

**Write gate (v1.0+):** all write directives (`@mkdir`, `@copy`, `@append-if-missing`, `@update-frontmatter`, `@render-template`) require `filesystem.write_enabled = true`. The default is off. Without the gate, rendering a document that uses write directives produces a clear error and skips the write.

> **Migrating from 0.x.** The pre-1.0 behavior was a single path jail rooted at the document directory. To restore the old behavior for data ops, set `filesystem.data_root = "auto"` in your security config. Most users will prefer the new default (`"cwd"`), which makes `@list ./src` resolve against the project root regardless of where the document lives.

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
@db using="primary" count="users" @cache session ttl=300
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
@db using="primary" aggregate="sales" group="name" sum="revenue" | @render type="bar"
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
| `call_macro` | Execute a named `@define` macro |
| `get_env` | Retrieve resolved environment variable values |
| `execute_directive` | Run a single directive and return the result |
| `get_constraints` | Return structured `@constraint` rules from the document |
| `invalidate_cache` | Clear session or persist cache entries |

---

### PreToolUse Hook

```bash
mai init
```

Installs a PreToolUse hook into your AI client (Claude Code, Cursor). When the AI calls `Read` on any `.md` file that is a MarkdownAI document, the hook blocks the raw read and returns a redirect message that tells the AI to fetch the file through the MarkdownAI MCP server instead. The MCP server runs every directive and returns the rendered output - so the AI sees live state, never directive syntax.

Detection covers two forms: a bare `@markdownai` header on the first non-blank line, and YAML frontmatter (`---` block) followed by `@markdownai`. The latter is what Claude Code slash-command files look like, so MDD-style routers and similar slash commands are correctly intercepted.

The redirect message catalogues every MarkdownAI MCP tool (`list_phases`, `resolve_phase`, `next_phase`, `read_file`, `execute_directive`, `call_macro`, `get_constraints`, `get_env`, `invalidate_cache`) with arg shapes, return shapes, and "use this when" guidance plus a five-step workflow. No ambiguity, no retry loop.

Re-running `mai init` is idempotent - the hook entry is matched in `settings.json` by command substring before being added.

---

### SessionStart Hook and CLAUDE-MarkdownAI.md (v1.0+)

`mai init` also installs a `SessionStart` hook. If your project has a file named `CLAUDE-MarkdownAI.md` at the project root, the hook runs `mai render` on it at every session start and injects the rendered output into the AI's session context. Your `CLAUDE.md` is never touched.

The pattern: `CLAUDE.md` is your static, user-owned project rules. `CLAUDE-MarkdownAI.md` is the live-data sibling - put MarkdownAI directives in it for today's date, current branch, open features, last test result, anything that should refresh on every session.

```markdown
# CLAUDE-MarkdownAI.md
@markdownai v1.0

@date format="YYYY-MM-DD" label=today
@count ./.mdd/docs/ match="*.md" label=doc_count

## Session brief

Today is {{ today }}. The project has {{ doc_count }} feature docs.

@foreach doc in @list ./.mdd/docs/ match="*.md"
  @read-frontmatter path="{{ doc }}" field="status" label=status
  - {{ doc }} ({{ status }})
@end
```

The hook emits a JSON envelope on stdout that Claude Code understands as `additionalContext`. The rendered text appears alongside `CLAUDE.md` in the system-level context - persistent for the session, same authority as project rules. Nothing is written to disk.

**The hook is silent when there's nothing to do.** Missing `CLAUDE-MarkdownAI.md`: silent exit 0. `mai` not on PATH: warning to stderr, exit 0. `mai render` fails: warning to stderr with the error, exit 0. Session always starts.

**Directive guidance for `CLAUDE-MarkdownAI.md`:** the render runs once per session start, so use flat, fast directives. Recommended: `@date`, `@count`, `@list`, `@read`, `@read-frontmatter`, `@hash`, `@tree`, `@if`, `@foreach`, `@set`, `@env`, `@call`, `@import`, `@include`. Avoid `@phase` (its lazy-load semantics defeat themselves in one-shot rendering). Use with care: `@http`, `@test`, `@check`, `@query`, `@db` - they run on every session start and slow it down by however long they take.

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

@include ./{{arg0}}-mode.md
```

That single line replaces this:

```markdown
@if ARGUMENTS.startsWith("audit")
  @include ./audit-mode.md
@elseif ARGUMENTS.startsWith("build")
  @include ./build-mode.md
@elseif ARGUMENTS.startsWith("plan")
  @include ./plan-mode.md
@endif
```

The engine routes to the correct file before Claude even sees the document. The AI receives only the content relevant to the actual invocation. Add a JS `||` default for when no argument is passed:

```markdown
@include ./{{arg0 || 'audit'}}-mode.md
```

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

**@note - Human-readable source comments:** Embed explanations for developers reading the raw `.md` file. Stripped from all rendered output by default. Add `visible` to render as a blockquote callout, or `visible consumer="human"` to scope it to human readers only. The human-facing counterpart to `@prompt`.

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
| `mai render <file> --passthrough` | Pass plain (non-MarkdownAI) files through unchanged instead of erroring |
| `mai render <file> --skill-args "<args>"` | Render with full Claude Code skill context. Sets `ARGUMENTS` and parses `argsList`. Defaults `data_root` to `cwd`. (v1.0+) |
| `mai render <file> --skill-dir <path>` | Set `CLAUDE_SKILL_DIR` for the render. Used with `${CLAUDE_SKILL_DIR}` in paths. (v1.0+) |
| `mai render <file> --skill-effort <low\|medium\|high>` | Set `EFFORT` for the render. (v1.0+) |
| `mai render <file> --skill-session-id <uuid>` | Set `CLAUDE_SESSION_ID` for the render. (v1.0+) |
| `mai validate <file>` | Check for errors and warnings; exits 1 on error |
| `mai parse <file>` | Output the document AST as JSON |
| `mai parse <file> --node <type> --pretty` | Filter and format AST output |
| `mai eval "<expression>"` | Evaluate a single expression against the environment |
| `mai strip <file>` | Remove all directives; output plain Markdown |
| `mai serve` | Start the MCP server |
| `mai serve --passthrough` | Start MCP server; pass plain files through the engine unchanged |
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

Condition operators: `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `\|\|`, `!`, `startsWith`, `endsWith`, `includes`, `file.exists`, `file.isFile`, `file.isDir`, `file.containsLine(path, regex)`, `file.containsSection(path, heading)`, `file.frontmatterField(path, field)`

### Iteration and Variables (v1.0+)

| Directive | Description |
|-----------|-------------|
| `@foreach <var> in <source>` ... `@end` | Render body once per item. Source can be a directive, a frontmatter list field, a label, or a literal CSV. |
| `@set <var> = "literal"` | Bind a literal value. |
| `@set <var> = @directive args` | Bind the rendered output of a directive. |
| `@set <var> = "{{ interpolated }}"` | Bind an interpolated string. |

### Data Sources

| Directive | Description |
|-----------|-------------|
| `@list <path>` | List filesystem entries or structured data from JSON/YAML/CSV. |
| `@read <path>` | Read and extract a value from a structured file. |
| `@read-frontmatter path="..." field="..."` | Read a single YAML field from a document's frontmatter (v1.0+). |
| `@hash path="..." algo=sha256 length=N` | Compute a content hash. Supports any Node crypto algorithm and a regex-based line-exclude (v1.0+). |
| `@tree <path>` | Render a directory tree. |
| `@date format="..."` | Current date/time in any format. |
| `@count <path> "<pattern>"` | Count files matching a pattern. |
| `@connect <name> type="<db>" uri=env.VAR` | Register a named database connection. |
| `@db using="<name>" find="<collection>"` | Query a collection or table using the MarkdownAI query language. |
| `@db using="<name>" raw="<native query>"` | Run a native query when joins or other raw SQL/MQL is needed. |
| `@query <command>` | Execute a shell command and use its stdout. |
| `@query <command> label=name` | Execute and store result in named label for reuse. |
| `@http <METHOD> <url>` | Make an HTTP request and use the response body. |
| `@http <METHOD> <url> expected=<code>` | Assert response status code. |

### Execution (v1.0+)

| Directive | Description |
|-----------|-------------|
| `@test command="<cmd>" label=name` | Run the project test suite. Inlines full output. Labels: `name` (full text), `name_exit` (exit code), `name_summary` (recognized one-liner). |
| `@check command="<cmd>" label=name` | Run typecheck / lint / build. Auto-detects via `scripts.typecheck`, `check`, `lint`, `build` when `command=` is omitted. |

### Filesystem Writes (v1.0+)

All write directives require `filesystem.write_enabled = true` and respect `write_root` + `allowed_write_paths`. Immutable always-block rules still apply.

| Directive | Description |
|-----------|-------------|
| `@mkdir <path>` | Create a directory. Recursive by default. |
| `@copy from="<src>" to="<dst>" [if-missing]` | Copy a file. `if-missing` makes it idempotent. |
| `@append-if-missing path="<file>" text="<line>"` | Append a line only if not already present. |
| `@update-frontmatter path="<doc>" field="<key>" value="<val>"` | Set a YAML frontmatter field. Supports `key[append]`, `key[N]`, nested `key[N].sub` addressing. |
| `@render-template from="<tpl>" to="<dst>"` ... `@end` | Render a template with injected parameters and write the result. Idempotent by default; pass `force` to overwrite. |

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

### Events and Signals

| Directive | Description |
|-----------|-------------|
| `@event name='x' data='...' transport='log'` | Fire a named signal to a transport during rendering. |
| `@event name='x' data='...' transport='mcp,log'` | Fire to multiple transports simultaneously. |
| `@event name='x' data='...' transport='mcp' visible` | Also render a blockquote in the document output. |

### AI-Native

| Directive | Description |
|-----------|-------------|
| `@consumer=ai` | Tag a block for AI consumers only. |
| `@consumer=human` | Tag a block for human readers only. |
| `@prompt` ... `@end` | Embed instructions for AI consumers (not in human output). |
| `@constraint <name>` ... `@end` | Declare a machine-readable rule. |
| `@note` ... `@end` | Human-readable source comment, always stripped. Add `visible` to render as a blockquote. |

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

## VS Code Extension

The MarkdownAI VS Code extension provides full IDE support for `.md` files that begin with `@markdownai`.

**Install it directly in VS Code** - open the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`), search for **MarkdownAI**, and click Install. Or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=markdownai.markdownai).

### Live Preview

The fastest way to learn MarkdownAI syntax is to write a directive and immediately see what it renders to. Open any MarkdownAI file and click the preview icon in the editor title bar, right-click the tab and choose **Open MarkdownAI Preview**, or run **MarkdownAI: Open MarkdownAI Preview** from the Command Palette.

The preview panel opens to the side, runs the engine on the saved file, and shows the rendered output as formatted Markdown. It refreshes automatically every time you save. Directives resolve to live values — `@date` shows today's date, `@list ./src/` shows your actual files, `@env` picks up your current environment. If the engine hits an error the preview shows the message inline rather than crashing.

> Requires the `mai` CLI: `npm install -g @markdownai/core`

### What it provides

**Language detection** - Any `.md` file whose first line is `@markdownai` is automatically re-tagged as the `markdownai` language type, activating all extension features. Files with YAML frontmatter before `@markdownai` are also detected.

**Syntax highlighting** - TextMate grammar covers all MarkdownAI directives: `@markdownai`, `@define`/`@end`, `@phase`/`@on`, `@if`/`@elseif`/`@else`/`@endif`, `@include`, `@import`, `@env`, `@call`, `@list`, `@read`, `@tree`, `@date`, `@count`, `@connect`, `@db`, `@http`, `@query`, `@render`, `@graph`, `@prompt`, `@constraint`, `@note`, `@cache`, `@section`, `@chunk-boundary`, `@define-concept`, and `{{ }}` interpolations.

**Snippets** - Tab-triggered snippets for all directives. Type `@def` and expand to a complete `@define`/`@end` block, `@if` to a full conditional, `@phase` to a phase skeleton, and so on. 15+ snippets covering core directives.

**Completion** - As you type `@`, the extension shows all valid directives with descriptions. Inside `@call`, it shows all macros defined in the current workspace. Inside `@import` and `@include`, it shows files matching `.md` in the workspace.

**Hover** - Hovering over any `@define` name or `@call` shows the macro definition inline.

**Go-to-definition** - `F12` or `Ctrl+click` on any `@call` name jumps to the `@define` that declares it, even across files linked by `@import`.

**Find all references** - Right-click any `@define` name and "Find All References" lists every `@call` site across the workspace.

**Diagnostics** - The extension checks documents as you type and reports:
- `@call` to undefined macros (error)
- `@include` and `@import` pointing to files that don't exist (error)
- `@env` variables without a fallback (warning, configurable)
- Undefined macros in `@call` positions (warning, configurable)

### Extension settings

| Setting | Default | Description |
|---------|---------|-------------|
| `markdownai.diagnosticsEnabled` | `true` | Enable/disable real-time diagnostics |
| `markdownai.warnUndefinedMacros` | `true` | Warn when `@call` references an undefined macro |
| `markdownai.warnMissingFallback` | `true` | Warn when `@env` has no fallback value |

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

**VS Code extension** - open Extensions (`Ctrl+Shift+X`), search **MarkdownAI**, click Install. Gets you syntax highlighting, snippets, completions, hover, diagnostics, and auto-indentation for MarkdownAI documents.

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
  engine/     @markdownai/engine    - execution, env resolution, pipe, cache, strip
  mcp/        @markdownai/mcp       - MCP server, 9 tools, phase navigation
  core/       @markdownai/core      - mai binary, all CLI commands
  vscode/     markdownai (VS Code)  - language detection, syntax highlighting, snippets, completions, hover, diagnostics
```

The parser is intentionally inert - it never executes anything. This separation means you can parse any document safely in any environment. The engine runs directives. The renderer formats output. The MCP server serves live context to AI tools. The core binary wires them together and exposes the CLI.

Security enforcement happens in the engine, not in individual directives. The security layer sits between the engine's directive runner and any external system. This means security gates apply regardless of which directive triggers the operation.

754 tests across all packages. The test suite includes unit tests for every directive, E2E tests for the full CLI pipeline, MCP protocol conformance tests, and a dedicated AI-native feature test suite.

---

## License

MIT

---

<p align="center">
  <strong>documentation that cannot lie.</strong>
</p>
