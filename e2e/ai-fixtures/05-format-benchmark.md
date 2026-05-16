@markdownai

---

# Format Benchmark Demo

---

**Status:** Active

**Version:** 1.0.0

---

## Features Overview

| Key | Value |
|-----|-------|
| Parser | AST-based |
| Engine | Walk-based |
| Format | Multi-mode |
| Renderer | Modular |

---

## Code Examples

The core pipeline in TypeScript:

```typescript
const ast = parse(source, { filePath })
const result = execute(ast, { filePath, ctx })
const output = aiFilter(result.output)
```

---

### Performance Notes

The AI format removes decorative elements while preserving all semantic content.


Excessive blank lines are compressed to a maximum of two consecutive lines.


**Decorative:** This standalone bold label will be stripped by aiFilter.

---

## Links and Lists

- [MarkdownAI Specification](https://example.com/spec)
- [Parser Documentation](https://example.com/parser)
- [Engine Documentation](https://example.com/engine)

> Important blockquote: This is preserved in AI format because it carries semantic weight.

## Summary

MarkdownAI produces token-efficient output without losing information.
All headings, code blocks, tables, links, lists, and blockquotes are preserved.
Only decorative chrome (horizontal rules, excessive whitespace, bold labels) is removed.

---
