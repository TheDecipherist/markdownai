# @markdownai/renderer

Format modules for MarkdownAI directive output. Takes a `string[]` and produces formatted markdown.

[Root README](../../README.md) · [Engine](../engine/README.md) · [GitHub](https://github.com/TheDecipherist/markdownai)

## Install

```bash
npm install @markdownai/renderer
```

## Formats

12 format types. The renderer is consumed internally by `@markdownai/engine` and the MCP server; you'd reach for it directly only when building tooling that formats data outside a full render pass.

| `type` | Output |
|---|---|
| `list` | `- item` bullets |
| `numbered` | `1.` `2.` ordered items |
| `links` | `- [label](url)` per item |
| `table` | Markdown grid table |
| `code` | Fenced code block |
| `inline` | Plain scalar, no wrapping |
| `bar` | ASCII horizontal bar chart |
| `flow` | `a -> b -> c` flow diagram |
| `tree` | ASCII indented tree |
| `timeline` | Left-to-right ASCII timeline |
| `json` | Pretty-printed JSON in a fenced block |
| `row` | **(new in v2)** JSON block for a single document |

## The `row` format

`row` formats a single object as a JSON code block. Pair it with `@db ... as=row label=X visible=false` to capture a struct into `ctx.data` without rendering anything inline:

```
@db
  using="local"
  find="features"
  where='id == "auth"'
  as=row
  label=feature
  visible=false
@db-end

{{ feature.title }} has {{ feature.source_files.length }} files
```

For full `@db` / `@read` usage with struct labels, see the [engine README](../engine/README.md).

## API

```ts
import { render, aiFilter } from '@markdownai/renderer'
import type { RenderType, RendererInput, AiFilterOptions } from '@markdownai/renderer'

render({ type: 'table', data: ['name | status', 'parser | ok'], columns: ['name', 'status'] })
render({ type: 'row', data: ['{"id":"auth","title":"Authentication"}'] })

const compressed = aiFilter(rendered)  // post-render pass that drops decorative whitespace
```

`RendererInput` is `{ type: RenderType, data: string[], columns?: string[], options?: Record<string, string> }`.

## License

MIT.
