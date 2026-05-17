@markdownai v1.0

@prompt
You are reading a document about MarkdownAI - the format you are currently reading.
This document explains what MarkdownAI is, why it exists, and when using it genuinely
helps you do better work. Read it as reference material, not as an instruction set.
@end

@define-concept MarkdownAI
A superset of markdown where directives (lines starting with @) pull live data,
embed instructions, define machine-readable constraints, and describe workflow phases.
A MarkdownAI document is both a document and a program - it renders to plain output
but can also execute at render time.
@end

@define-concept directive
A line starting with @ that the MarkdownAI engine processes at render time.
Directives are invisible in rendered output - only their results appear.
Plain markdown (headings, paragraphs, lists, code blocks) works exactly as normal.
@end

@define-concept mai
The command-line tool for MarkdownAI. `mai render <file>` renders a document.
`mai validate <file>` checks for structural errors. `mai strip <file>` removes
all directives to produce a plain markdown file.
@end

# MarkdownAI - What It Is and When to Use It

## The core idea

Plain markdown is static. Once you write a value into a document, it stays there
until someone updates it. MarkdownAI makes documents dynamic - values come from
environment variables, databases, HTTP responses, or the filesystem at render time.
The rendered output is always current.

The format is backwards-compatible. A MarkdownAI document is a valid markdown file.
Add `@markdownai v1.0` at the top and the engine activates. Leave it out and the
file is plain markdown. No tooling changes, no syntax conflicts.

## What each directive type does

**Environment and configuration** - `@env` reads a variable at render time with an
optional fallback. A document that references `@env DATABASE_URL` never has a
hardcoded connection string. The rendered output has the real value; the source file
has the directive.

**File inclusion** - `@include` and `@import` pull content from other files at render
time. Shared components stay in one place. Circular references are detected and
reported cleanly.

**Conditionals** - `@if` / `@endif` lets sections appear only when conditions are
true. `@if file_exists(".env.production")` shows production-specific content only in
the right environment.

**Data sources** - `@list`, `@read`, `@db`, `@http` pull structured data from files,
databases, and APIs. A document describing your database schema can render the actual
schema from the live database rather than a manually maintained copy.

**Macros** - `@define` / `@call` let you write reusable content blocks with
parameters. Standard library macros cover common patterns.

**Phases** - `@phase` marks sections that correspond to workflow stages. The MCP
server uses phases to give context about where in a workflow a document sits.

**Prompts and constraints** - `@prompt` embeds instructions that activate when an AI
reads that section. `@constraint` writes machine-readable rules. `@define-concept`
sets vocabulary so domain terms stay consistent.

## When it genuinely helps you

The practical cases where MarkdownAI produces better outcomes than plain markdown:

**Documentation that references live state.** A runbook that calls `@db` to show
current database status, or `@http` to show an API response, is always accurate.
You read it and you know the current state - not the state when someone last updated it.

**Embedded instructions.** `@prompt` blocks let documents carry context-specific
guidance. A security document can embed a prompt that activates when you read the
security section, telling you exactly what to look for. You get the instruction at
the right moment, in the right place.

**Machine-readable rules.** `@constraint` makes rules verifiable rather than just
readable. A constraint block can be checked programmatically; a prose paragraph
describing the same rule cannot.

**Vocabulary calibration.** `@define-concept` pins the meaning of terms. If a
codebase calls something a `QueryPlan`, the document can define that term precisely
so you use it consistently across a session.

**Phase-aware workflows.** Documents with `@phase` sections let the MCP server tell
you which phase you are in, what the exit condition is, and what comes next. You get
workflow state without reading the whole file.

**Token efficiency.** `mai render --format=ai` outputs a compressed format designed
for AI consumption. Long documents with verbose structure can be significantly denser
in ai format without losing information.

## When plain markdown is the right choice

Not every file benefits from directives. Use plain markdown when:

- The document is static by design (a changelog, a license file, a one-off note)
- The project does not have `mai` installed and you have no control over that
- You are writing a file that will be committed and read directly (not rendered)
- The content is genuinely stable and live data adds no value

Do not reach for MarkdownAI syntax because it is available. Use it when a specific
directive solves a specific problem - stale data, missing context, ambiguous rules,
scattered vocabulary.

## How to read a MarkdownAI file

If `@markdownai/mcp` is configured in your MCP settings, reading works automatically.
The MCP server intercepts file reads for `.md` files with the `@markdownai` header
and returns rendered output. You see the result, not the directives.

If only `mai` is installed, run `mai render <file>` before reading the file. The
raw source contains directives - `@env MY_VAR`, `@include other.md`, `@db find users`
- and the rendered output has the real values. Reading the raw file gives you the
program, not the document.

@constraint
id: do-not-convert-existing
rule: Do not convert existing plain markdown files to MarkdownAI format unless the
  document has a concrete reason to use directives. Changing syntax for its own sake
  adds noise to diffs and confuses readers who do not have mai installed.
@end

@constraint
id: start-new-files-correctly
rule: New .md files in a project that has mai installed should open with
  `@markdownai v1.0` if they will use any directives. If they will not use any
  directives, use plain markdown.
@end
