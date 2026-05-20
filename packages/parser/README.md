# @markdownai/parser

<p align="center">
  <a href="https://markdownai.dev">
    <img src="https://img.shields.io/badge/📖_Documentation-markdownai.dev-0891b2?style=for-the-badge&labelColor=08090f" alt="Documentation Site" />
  </a>
  &nbsp;
  <a href="https://markdownai.dev/user-guide.html">
    <img src="https://img.shields.io/badge/📚_User_Guide-Full_Reference-059669?style=for-the-badge&labelColor=08090f" alt="User Guide" />
  </a>
</p>

Pure AST parser for MarkdownAI documents. Reads `.md` source and returns a typed AST with no side effects - no execution, no IO, no filesystem access.

**All packages:**
[@markdownai/core](https://www.npmjs.com/package/@markdownai/core) &nbsp;·&nbsp;
[@markdownai/engine](https://www.npmjs.com/package/@markdownai/engine) &nbsp;·&nbsp;
[@markdownai/parser](https://www.npmjs.com/package/@markdownai/parser) &nbsp;·&nbsp;
[@markdownai/renderer](https://www.npmjs.com/package/@markdownai/renderer) &nbsp;·&nbsp;
[@markdownai/mcp](https://www.npmjs.com/package/@markdownai/mcp) &nbsp;·&nbsp;
[@markdownai](https://www.npmjs.com/package/@markdownai/markdownai)

**Links:** [GitHub](https://github.com/TheDecipherist/markdownai) &nbsp;·&nbsp; [npm org](https://www.npmjs.com/package/@markdownai/markdownai)

---

## What it does

`@markdownai/parser` is the first stage of the MarkdownAI toolchain. It reads a MarkdownAI document line by line and produces a complete, typed AST (abstract syntax tree) describing every directive, block, inline expression, and plain markdown node in the file.

It is completely inert. Parsing a document has no side effects - nothing is fetched, no files are read, no environment variables are touched. This makes it safe to use in any context, including editors, linters, and static analysis tools.

Every `mai` command uses this parser internally. You'd reach for it directly if you need to analyze or transform MarkdownAI source without running it.

## Installation

```bash
npm install @markdownai/parser
```

Requires Node.js >= 18.

## Usage

```ts
import { parse } from '@markdownai/parser'

const source = `@markdownai

@env DATABASE_URL fallback="postgres://localhost:5432/mydb"

# Status Report

Files in src: @count ./src/ match="**/*.ts"
`

const ast = parse(source)

// ast.header - the @markdownai declaration node
// ast.nodes  - array of typed directive and markdown nodes
```

## The @markdownai Header

A MarkdownAI document must start with `@markdownai` on line 1. If the header is missing, the file is treated as plain Markdown - the parser returns a plain AST with no directive nodes.

You can pin a version: `@markdownai v1.0`. The parser records the version in the header node.

```ts
const ast = parse('@markdownai v1.0\n\n# My Doc\n')
console.log(ast.header.version) // "1.0"
```

## Node Types

The parser produces a flat array of typed nodes. Every node has a `type` field as a discriminant.

### Directive nodes

| Type | Directive | Description |
|------|-----------|-------------|
| `EnvNode` | `@env` | Environment variable declaration with optional fallback |
| `QueryNode` | `@query` | Shell command execution |
| `HttpNode` | `@http` | HTTP request |
| `DbNode` | `@db` | Database query block |
| `ConnectNode` | `@connect` | Database connection registration |
| `ListNode` | `@list` | Filesystem or structured data listing |
| `ReadNode` | `@read` | Structured file read |
| `TreeNode` | `@tree` | Directory tree rendering |
| `DateNode` | `@date` | Date/timestamp injection |
| `CountNode` | `@count` | File count |
| `IncludeNode` | `@include` | Content inclusion |
| `ImportNode` | `@import` | Definition import |
| `DefineNode` | `@define` | Macro definition block |
| `CallNode` | `@call` | Macro invocation |
| `ConditionalNode` | `@if / @elseif / @else / @endif` | Conditional block with branches |
| `PhaseNode` | `@phase` | Phase block with `@on complete` transitions |
| `PipeNode` | `source | transform | @render` | Pipe chain |
| `RenderNode` | `@render` | Render sink with format type |
| `PromptNode` | `@prompt` | AI instruction block |
| `NoteNode` | `@note` | Human-readable source comment (stripped by default) |
| `SectionNode` | `@section` | Context budget priority section |
| `MarkdownNode` | (plain text) | Non-directive markdown content |
| `InterpolationNode` | `{{ expression }}` | Inline expression |
| `ShellInlineNode` | `` !`command` `` | Shell inline (Claude Code syntax) |

### Block structure

Block directives (`@define`, `@phase`, `@if`, `@prompt`, `@note`, `@section`) open with the directive and close with `@end` or `@endif`. The parser tracks nesting and returns each block as a single node with its children.

```ts
const ast = parse(`@markdownai

@define greeting(name)
Hello, {{ name }}!
@end
`)

const defineNode = ast.nodes.find(n => n.type === 'DefineNode')
// defineNode.name     - "greeting"
// defineNode.params   - ["name"]
// defineNode.body     - array of child nodes
```

### Pipe chains

Pipe expressions are parsed as a single `PipeNode` containing the source, transform steps, and optional render sink:

```ts
// @list ./src/ | grep \.ts$ | sort | @render type="numbered"
// PipeNode {
//   source: ListNode { path: './src/' },
//   steps:  ['grep \\.ts$', 'sort'],
//   sink:   RenderNode { type: 'numbered' }
// }
```

## API Reference

### `parse(source: string): MarkdownAIDocument`

Parses a MarkdownAI document string and returns the AST.

- `source` - the full document text
- Returns a `MarkdownAIDocument` with `header` and `nodes` fields
- Throws `ParseError` if a block directive is unclosed or the structure is invalid

### `ParseError`

Thrown when the document has a structural error (unclosed `@define`, nested `@phase` in an import, etc.). Has `message`, `line`, and `directive` fields.

```ts
import { parse, ParseError } from '@markdownai/parser'

try {
  parse('@markdownai\n@define foo\n# unclosed')
} catch (e) {
  if (e instanceof ParseError) {
    console.error(`Parse error at line ${e.line}: ${e.message}`)
  }
}
```

### `scanInterpolations(source: string): string[]`

Returns all `{{ expression }}` expressions found in a source string. Useful for static analysis without a full parse.

```ts
import { scanInterpolations } from '@markdownai/parser'

const exprs = scanInterpolations('Hello {{ name }}, today is {{ date format="YYYY-MM-DD" }}')
// ["name", 'date format="YYYY-MM-DD"']
```

### `scanShellInlines(source: string): string[]`

Returns all `` !`command` `` shell inline expressions found in a source string.

```ts
import { scanShellInlines } from '@markdownai/parser'

const cmds = scanShellInlines('Branch: !`git branch --show-current`')
// ["git branch --show-current"]
```

## What the parser does NOT do

- Execute any directive
- Read any file
- Make any network request
- Access environment variables
- Resolve macros or evaluate expressions

All of that happens in `@markdownai/engine`.

## TypeScript

The parser is written in strict TypeScript and ships with full type declarations. All AST node types are exported and usable directly:

```ts
import type { MarkdownAIDocument, DefineNode, ConditionalNode, PipeNode } from '@markdownai/parser'

function findMacros(doc: MarkdownAIDocument): DefineNode[] {
  return doc.nodes.filter((n): n is DefineNode => n.type === 'DefineNode')
}
```

## Part of the MarkdownAI toolchain

The parser is the first step in the pipeline. To go further:

- **Execute directives** - use [`@markdownai/engine`](https://www.npmjs.com/package/@markdownai/engine)
- **Format output** - use [`@markdownai/renderer`](https://www.npmjs.com/package/@markdownai/renderer)
- **Run from the CLI** - install [`@markdownai/core`](https://www.npmjs.com/package/@markdownai/core) globally
- **Serve to AI tools** - use [`@markdownai/mcp`](https://www.npmjs.com/package/@markdownai/mcp)

## License

MIT - [GitHub](https://github.com/TheDecipherist/markdownai)
