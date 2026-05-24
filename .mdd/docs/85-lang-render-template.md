---
id: 85-lang-render-template
title: Language — @render-template Directive (Document Scaffolding)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 08-lang-macros, 09-lang-file-resolution, 23-security-filesystem]
relates: [10-lang-include, 11-lang-import, 84-lang-frontmatter-ops]
source_files:
  - packages/parser/src/directives/render-template.ts
  - packages/engine/src/exec-ops.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/render-template.test.ts
data_flow: writes-existing
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [render-template, template, scaffold, macro, directive, language, codegen]
path: Language/Templates
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/exec-ops.ts
known_issues: []
---

# 85 — Language — @render-template Directive

## Purpose

`@render-template` loads a MarkdownAI template file, substitutes macro
parameters with provided values, and writes the rendered output to a
destination file. It is the primary scaffolding mechanism - used to generate
new documents, config files, or any file whose shape is known but whose
content needs parameterisation.

Unlike `@include` (which inlines content into the current document),
`@render-template` writes to a separate output file. This makes it suitable
for one-shot generation and MDD-style bootstrap procedures.

## Architecture

**Parser — `packages/parser/src/directives/render-template.ts`**

Parses the block directive and returns a `RenderTemplateNode` with:
- `from: string` - source template path
- `to: string` - destination output path
- `force: boolean` - whether to overwrite existing destination
- `ifMissing: boolean` - write only if destination does not exist (default behaviour)
- `params: Record<string, string>` - key-value pairs from the block body

The block body contains `key=value` parameter lines. Positional flags (`force`,
`if-missing`) are normalized to named boolean arguments during parse.

**Engine — `packages/engine/src/exec-ops.ts`**

`executeRenderTemplate(node, ctx)`:
1. Resolves `from` path through the data jail (template must be inside jail root)
2. Resolves `to` path through the write jail
3. Checks destination existence against `force`/`ifMissing` flags
4. Reads the template file, strips the `@markdownai` header line if present
5. Calls `substituteParams(templateContent, node.params)` to perform macro substitution
6. Writes output to destination

## Data Model

No persistence. `RenderTemplateNode` is an AST node only.

```typescript
interface RenderTemplateNode extends ASTNodeBase {
  type: 'render-template'
  from: string
  to: string
  force: boolean
  ifMissing: boolean
  params: Record<string, string>
}
```

## API Endpoints

None. Language directive only.

## Business Rules

**Syntax:**
```
@render-template from="templates/feature-doc.md" to=".mdd/docs/03-my-feature.md"
  id=03-my-feature
  title=My Feature
  status=draft
@end

@render-template from="templates/config.json" to="config.json" force
  env=production
  port=3000
@end

@render-template from="templates/readme.md" to="README.md" if-missing
  project=my-project
@end
```

**Overwrite behaviour:**
- Neither flag set (default) → `ifMissing` behaviour: skip if destination exists
- `if-missing` → skip if destination exists (explicit form of default)
- `force` → overwrite destination regardless

**Template format:**
Templates are standard MarkdownAI files (or plain text). The `@markdownai`
header line is stripped from the rendered output. Macro substitution uses
`{{ key }}` or `<<key>>` syntax matching `substituteParams()` from the macros module.

**Parameter passing:**
Block body lines in `key=value` format become the substitution context. Values
are treated as plain strings - no expression evaluation inside parameters.

**Security:**
Template source must be within the data jail. Destination must be within the
write jail. Both paths are resolved relative to `ctx.cwd`.

## Data Flow

Block directive parsed → `RenderTemplateNode` with `from`, `to`, flags, and
params map. At execution: jail checks → conditional existence check → template
read → header strip → `substituteParams()` → destination write.

## Dependencies

- `01-parser`: `RenderTemplateNode` in the `ASTNode` union
- `03-engine`: execution wired into `walkNode` switch
- `08-lang-macros`: `substituteParams()` handles `{{ key }}` replacement in template content
- `09-lang-file-resolution`: path resolution and jail enforcement
- `23-security-filesystem`: data jail (from) and write jail (to)

## Security

Template source and destination are both jail-checked before any I/O. Parameter
values are substituted as literal strings - no expression evaluation runs on
parameter values. The directive cannot write outside the write jail regardless of
what `to` path is specified.

## Known Issues

(none yet)
