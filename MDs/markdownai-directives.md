@markdownai v1.0

# MarkdownAI Directives

All directives available in MarkdownAI, organized by category.

---

## Document Structure

| Directive | Purpose |
|---|---|
| `@markdownai` | Document header - activates the MarkdownAI runtime |
| `@include` | Inline file content at the directive site |
| `@import` | Import definitions (macros, connections) without rendering content |
| `@define` / `@end` | Declare a named macro |
| `@call` | Invoke a macro |
| `@phase` / `@end` | Declare a workflow phase |
| `@if` / `@end` | Conditional block |
| `@section` | Named section boundary |
| `@chunk-boundary` | Explicit chunk split point for rendering |

## Variables & Environment

| Directive | Purpose |
|---|---|
| `@env` | Resolve an environment variable |

## Data Sources

| Directive | Purpose |
|---|---|
| `@connect` | Register a named data source connection |
| `@db` | Execute a database query |
| `@http` | Fetch from an HTTP endpoint |
| `@query` | Query a registered data source |
| `@read` | Read raw file content |
| `@list` | List directory contents |
| `@tree` | Directory tree output |
| `@date` | Current date/time |
| `@count` | Count items in a source |

## Processing & Output

| Directive | Purpose |
|---|---|
| `@pipe` | Chain output through transformations |
| `@render` | Render output in a specific format |
| `@graph` | Generate a visualization |
| `@header` | Document-level metadata header |

## Annotations & Constraints

| Directive | Purpose |
|---|---|
| `@constraint` | Machine-readable rule or constraint |
| `@define-concept` | Vocabulary alignment - bind a term to a precise definition |
| `@prompt` | Embedded instruction for the AI reading the document |
| `@note` | Human-readable annotation (not rendered in AI format) |

## Caching

| Directive | Purpose |
|---|---|
| `@cache` | Cache directive output (option on data source directives) |

## Phase Events

| Directive | Purpose |
|---|---|
| `@on complete ->` | Declare what executes when a phase finishes (only valid inside `@phase` blocks) |

---

27 directive modules in the parser. `@on complete ->` is a phase-scoped event keyword. `@local` is a scope modifier on `@define`, `@include`, and `@import` - not a standalone directive.
