---
generated: 2026-05-15
doc_count: 32
connection_count: 12
overlap_count: 0
---

# Connections

## Path Tree

```
@markdownai/parser
  └── @markdownai/renderer (imports parser AST types)
  └── @markdownai/engine   (imports parser, renderer)
      └── @markdownai/mcp  (imports engine, parser, renderer)
      └── @markdownai/core (imports engine, parser, renderer, mcp)
```

## Dependency Graph

| From | To | Reason |
|------|----|--------|
| renderer | parser | Consumes AST node types |
| engine | parser | Parses documents, walks AST |
| engine | renderer | Formats pipe output |
| mcp | engine | strip(), render, cache management |
| mcp | parser | Phase/transition queries |
| mcp | renderer | Phase content rendering |
| core | engine | runRender, runValidate, runStrip, security, cache |
| core | parser | runParse, runListImports |
| core | renderer | (via engine) |
| core | mcp | startServer() via dynamic import in `serve` command |

## Source File Overlap

(none — each package owns exclusive source files)

## Warnings

(none)
