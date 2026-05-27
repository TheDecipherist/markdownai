# @markdownai/parser

Pure AST production for MarkdownAI documents. Reads `.md` source, returns a typed tree. No execution, no IO.

[Root README](../../README.md) · [Spec v2.0](../../MDs/markdownai-spec-v2.0.md) · [Engine](../engine/README.md) · [GitHub](https://github.com/TheDecipherist/markdownai)

## Install

```bash
npm install @markdownai/parser
```

## What changed in v2

- **Three directive forms** unified under one grammar: self-closing (`@name ... /`), block-with-attrs (`@name` + indented attrs + `@name-end`), block-with-attrs+body (same, with body after a blank line or `>`). Full grammar in the [spec](../../MDs/markdownai-spec-v2.0.md#grammar-three-forms).
- **Close tags carry the directive name.** `@phase-end`, `@if-end`, `@foreach-end`. Bare `@end`, `@endif`, `@endswitch` are no longer accepted.
- **`@on-complete <phase> /`** replaces v1's `@on complete -> X` arrow transitions.
- **Nested same-name blocks** are supported. The parser depth-tracks `@if` inside `@if`, etc.
- **`block: bool` on `ParseModule` is gone.** Every directive uses the same shape; the parser figures out form 1 vs 2 vs 3 from the opener line.
- **`DirectiveInput`** is the new input record passed to each directive's `parse()`:

```ts
interface DirectiveInput {
  positional: string         // first token after the directive name
  attrs: Record<string, string>
  flags: string[]            // bare-name tokens (no `=`)
  body: string[]             // raw body lines, empty for forms 1/2
  isSelfClosed: boolean      // true when opener ended with ` /`
  line: number               // 1-based opener line
  rawArgs: string            // verbatim opener text after the name
}
```

## Worked example

```ts
import { parse } from '@markdownai/parser'

const ast = parse(`@markdownai v2.0

@phase setup
  required=true
>
  @touch path="src/foo.ts" /
  @on-complete build /
@phase-end
`)

// ast.header.version === "2.0"
// ast.nodes[0] === {
//   type: 'PhaseNode',
//   name: 'setup',
//   attrs: { required: 'true' },
//   body: [
//     { type: 'TouchNode', path: 'src/foo.ts', ... },
//     { type: 'OnCompleteNode', target: 'build', ... },
//   ],
//   line: 3,
// }
```

## API

- `parse(source: string, options?: ParseOptions): ParseResult` - returns `{ header, nodes }` or throws `ParseError`.
- `ParseError` - has `message`, `sourceLine`, `filePath`.
- `scanInterpolations(source)` - returns `{{ }}` expressions without a full parse.
- `scanShellInlines(source)` - returns `` !`...` `` expressions.
- `getAvailableDirectives()` - registry of every registered directive.

All AST node types are exported under `MarkdownAIDocument`, `PhaseNode`, `DefineNode`, `ConditionalNode`, etc. The full set lives in `src/types.ts`.

## Migration from v1

Mechanical rewrite via the bundled script:

```bash
node packages/parser/scripts/migrate-v1-to-v2.mjs <file> --in-place
```

The script is idempotent. Re-running on a v2 file is a no-op. It handles bare `@end` rewrites, arrow-transition rewrites, multi-line attrs for inline directives, and the `as=row` shorthand. Run `--dry-run` first if you want to see the diff.

## What this package does not do

Execute directives. Read files. Make HTTP requests. Resolve macros. All of that lives in [`@markdownai/engine`](../engine/README.md).

## License

MIT.
