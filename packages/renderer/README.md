# @markdownai/renderer

<p align="center">
  <a href="https://markdownai.dev">
    <img src="https://img.shields.io/badge/📖_Documentation-markdownai.dev-00e5cc?style=for-the-badge&labelColor=08090f" alt="Documentation Site" />
  </a>
  &nbsp;
  <a href="https://markdownai.dev/user-guide.html">
    <img src="https://img.shields.io/badge/📚_User_Guide-Full_Reference-00ff88?style=for-the-badge&labelColor=08090f" alt="User Guide" />
  </a>
</p>

Output formatting for MarkdownAI. Takes rendered data and formats it into 11 different ASCII/Markdown output types - lists, tables, charts, trees, timelines, and more.

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

`@markdownai/renderer` is the output layer of the MarkdownAI toolchain. Once the engine has executed your directives and assembled the data, the renderer decides how that data looks in the final document.

Every visualization is pure ASCII - no JavaScript, no browser, no external charting libraries. The output is valid Markdown that renders correctly in any Markdown viewer, terminal, AI context, or plain text file.

The renderer is consumed internally by `@markdownai/engine` and `@markdownai/mcp`. You'd use it directly if you're building tooling that needs to format MarkdownAI-style data outside of a full render pipeline.

## Installation

```bash
npm install @markdownai/renderer
```

Requires Node.js >= 18.

## Output Formats

In MarkdownAI documents, you select a format using the `type` option on a `@render` sink or the `as` shorthand on any data directive:

```
@list ./src/ match="**/*.ts" | sort | @render type="numbered"
@db using="reports" query="..." as="table"
```

| Format | `type` value | Output |
|--------|-------------|--------|
| Unordered list | `list` | `- item` bullets |
| Numbered list | `numbered` | `1.` `2.` ordered items |
| Link list | `links` | `- [label](url)` for each item |
| Grid table | `table` | Markdown table with headers and rows |
| Code block | `code` | Fenced ` ``` ` block (language auto-detected) |
| Inline | `inline` | Plain scalar value, no wrapping |
| Bar chart | `bar` | Horizontal ASCII bar chart |
| Flow diagram | `flow` | ASCII flow diagram with arrows |
| Tree | `tree` | ASCII indented tree for nested data |
| Timeline | `timeline` | Left-to-right ASCII timeline |
| JSON | `json` | Pretty-printed JSON in a fenced code block |

### Examples

**Table:**
```
@db using="reports" query="SELECT name, status, updated_at FROM tasks" as="table"
```
Produces:
```
| name | status | updated_at |
|------|--------|------------|
| Auth | done   | 2026-05-01 |
| API  | active | 2026-05-16 |
```

**Bar chart:**
```
@db using="analytics" query="SELECT region, count FROM visits" as="bar"
```
Produces:
```
us-east  ████████████████ 812
eu-west  ████████ 401
ap-south ████ 198
```

**Flow diagram:**
```
@list ./stages/ | @render type="flow"
```
Produces:
```
parse -> execute -> render -> output
```

**Tree:**
```
@list ./packages/ type="dirs" | @render type="tree"
```
Produces:
```
packages/
├── core/
├── engine/
├── mcp/
├── parser/
└── renderer/
```

**Timeline:**
```
@db using="reports" query="SELECT date, event FROM releases" as="timeline"
```
Produces:
```
2026-01-01 ── initial release ── 2026-03-01 ── v0.1.0 ── 2026-05-01 ── v0.2.0
```

## AI Filter

The `aiFilter` function applies a post-render compression pass that removes decorative elements while keeping all meaningful content. Used by the MCP server when serving documents to AI tools.

What it strips:
- Horizontal rules (`---`, `***`)
- Redundant blank lines (collapses to single blank lines)
- Standalone bold labels with no content value

What it keeps:
- All headings, code blocks, tables, lists, links, blockquotes
- All meaningful prose
- AI instruction blocks (`@prompt` output)

The result is typically 15-40% fewer tokens for the same information content.

## API Reference

### `render(data: unknown, type: RenderType): string`

Renders data into a formatted markdown string.

- `data` - the data to render. Can be a string, array of strings, array of objects (for table/bar/timeline), or a nested object (for tree/json)
- `type` - one of the 11 format types listed above
- Returns a formatted markdown string

```ts
import { render } from '@markdownai/renderer'

const rows = [
  { name: 'parser', status: 'stable', version: '0.0.1' },
  { name: 'engine', status: 'stable', version: '0.0.1' },
]

const table = render(rows, 'table')
// | name   | status | version |
// |--------|--------|---------|
// | parser | stable | 0.0.1   |
// | engine | stable | 0.0.1   |

const list = render(['parser', 'engine', 'renderer'], 'list')
// - parser
// - engine
// - renderer

const bar = render([{ label: 'tests', value: 689 }, { label: 'errors', value: 0 }], 'bar')
// tests  ██████████████████████████ 689
// errors  0
```

### `aiFilter(markdown: string, options?: AiFilterOptions): string`

Applies AI-optimized compression to a rendered markdown string.

- `markdown` - the rendered markdown to compress
- `options` - optional `AiFilterOptions` to control what gets stripped
- Returns the compressed string

```ts
import { aiFilter } from '@markdownai/renderer'

const compressed = aiFilter(renderedOutput)
```

### `AiFilterOptions`

```ts
interface AiFilterOptions {
  stripHorizontalRules?: boolean  // default: true
  collapseBlankLines?: boolean    // default: true
  stripDecorative?: boolean       // default: true
}
```

## TypeScript

Full type declarations are included. The `RenderType` union type lists all valid format strings:

```ts
import type { RenderType } from '@markdownai/renderer'

function formatData(data: unknown, format: RenderType): string {
  return render(data, format)
}
```

## Part of the MarkdownAI toolchain

- **Parse documents** - use [`@markdownai/parser`](https://www.npmjs.com/package/@markdownai/parser)
- **Execute directives** - use [`@markdownai/engine`](https://www.npmjs.com/package/@markdownai/engine)
- **Run from the CLI** - install [`@markdownai/core`](https://www.npmjs.com/package/@markdownai/core) globally
- **Serve to AI tools** - use [`@markdownai/mcp`](https://www.npmjs.com/package/@markdownai/mcp)

## License

MIT - [GitHub](https://github.com/TheDecipherist/markdownai)
