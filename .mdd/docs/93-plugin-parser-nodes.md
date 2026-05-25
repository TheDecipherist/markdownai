---
id: 93-plugin-parser-nodes
title: Plugin Parser Nodes
edition: MarkdownAI
depends_on: ["01-parser"]
relates: ["94-plugin-loader"]
source_files:
  - packages/parser/src/types.ts
  - packages/parser/src/directives/plugin-meta.ts
  - packages/parser/src/directives/plugin-detect.ts
  - packages/parser/src/directives/plugin-layout.ts
  - packages/parser/src/directives/plugin-conventions.ts
  - packages/parser/src/parser-blocks.ts
  - packages/parser/src/parser.ts
  - packages/parser/src/registry.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/plugin-parser-nodes.test.ts
data_flow: greenfield
last_synced: 2026-05-25
status: complete
phase: all
mdd_version: 11
tags: [parser, ast, plugin-system, plugin-meta, plugin-detect, plugin-layout, plugin-conventions, node-types]
path: Parser/Plugins
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
initiative: markdownai-plugin-system
wave: markdownai-plugin-system-wave-1
wave_status: active
---

# 93 - Plugin Parser Nodes

## Purpose

Adds four new AST node types to the parser for `@plugin-*` block directives: `@plugin-meta`, `@plugin-detect`, `@plugin-layout`, and `@plugin-conventions`. These blocks appear in `.plugin.md` files and declare framework identity, detection rules, directory layout, and naming conventions. The parser recognizes and captures them as structured nodes with raw body text; the loader (feature 94) validates and interprets the content.

## Architecture

The feature is purely additive — no existing directive behavior changes. It follows the established parser pattern for body-capturing block directives (`@note`, `@constraint`, `@prompt`):

1. Four new `ParseModule` files in `packages/parser/src/directives/` — each is `block: true` with `closeTag: 'end'` and returns an empty-body node from `parse()`.
2. A new `parsePluginBlock()` function in `parser-blocks.ts` that collects raw lines until `@end` and returns the appropriate typed node. Avoids duplicating the pattern across four explicit handlers.
3. Four explicit dispatch cases added to `parseDirective()` in `parser.ts`.
4. Four new interface definitions in `types.ts`, each with `type`, `line`, and `body: string`. The `ASTNode` union is extended to include all four.
5. Four new imports and registrations in `registry.ts`.

The body of each plugin block is captured as raw trimmed text (indented YAML-like content). The parser does not attempt to parse YAML — that responsibility belongs to the loader.

```
plugin-meta.ts        plugin-detect.ts       plugin-layout.ts     plugin-conventions.ts
     |                      |                      |                       |
     +---------- parsePluginBlock() in parser-blocks.ts ------------------+
                             |
                  parseDirective() in parser.ts (4 new cases)
                             |
                    ASTNode union in types.ts
```

## Data Model

Four new interfaces extending `ASTNodeBase`:

```typescript
interface PluginMetaNode extends ASTNodeBase {
  type: 'plugin-meta'
  body: string  // raw YAML-like content: framework_name, framework_version, marker_version
}

interface PluginDetectNode extends ASTNodeBase {
  type: 'plugin-detect'
  body: string  // raw content: required_marker, required_files, required_dirs, version_signal
}

interface PluginLayoutNode extends ASTNodeBase {
  type: 'plugin-layout'
  body: string  // raw content: directories, files, tree
}

interface PluginConventionsNode extends ASTNodeBase {
  type: 'plugin-conventions'
  body: string  // raw content: naming, required_frontmatter_fields
}
```

All four are added to the `ASTNode` union type.

## API Endpoints

None - this is a parser package extension.

## Business Rules

- `@plugin-meta`, `@plugin-detect` are required blocks in a valid plugin file. However, **the parser does not enforce this** - that validation belongs to the loader. The parser accepts any combination of plugin blocks in any order and produces AST nodes.
- All four block types use `@end` as the close tag.
- No arguments are accepted after the block opener (`@plugin-meta`, `@plugin-detect`, etc.). Any text after the directive name on the opening line is ignored.
- If a plugin block is unclosed (no `@end` found before EOF), `parsePluginBlock()` throws a `ParseError`.
- Plugin blocks may appear in non-plugin `.md` files — the parser does not enforce file-type restrictions. The engine or loader decides whether plugin nodes are valid in context.
- Body content is captured as-is (raw lines joined with `\n`, then trimmed of leading/trailing whitespace). Indentation inside the block is preserved for the loader.

## Data Flow

Greenfield - no existing data flows are consumed or modified.

## Dependencies

Depends on `01-parser` for:
- `ASTNodeBase`, `ASTNode`, `ParseModule`, `ParseContext`, `ParseError` interfaces from `types.ts`
- `parseArgs` utility from `args.ts` (not used, but available)
- `State`, `peek`, `consume` from `parser-state.ts` (used in `parsePluginBlock`)
- `ParseError` for unclosed-block error
- Registry registration pattern from `registry.ts`

## Security

Plugin blocks are parsed as raw text — no evaluation, no execution, no filesystem access during parsing. The parser itself introduces no security surface. The security boundary is enforced by the loader (feature 94), which validates that plugin bodies contain no executable directives before accepting them.

## Known Issues

(none)

## Bugs

(none yet)
