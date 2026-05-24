---
id: 84-lang-frontmatter-ops
title: Language — @read-frontmatter and @update-frontmatter Directives
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 09-lang-file-resolution, 23-security-filesystem]
relates: [15-lang-sources-read, 83-lang-foreach-set]
source_files:
  - packages/parser/src/directives/read-frontmatter.ts
  - packages/parser/src/directives/update-frontmatter.ts
  - packages/engine/src/read-ops.ts
  - packages/engine/src/write-ops.ts
  - packages/engine/src/frontmatter-utils.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/read-frontmatter.test.ts
  - packages/engine/src/__tests__/update-frontmatter-list.test.ts
data_flow: mixed
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [frontmatter, yaml, read-frontmatter, update-frontmatter, directive, language, metadata]
path: Language/Frontmatter
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/read-ops.ts
  - packages/engine/src/write-ops.ts
known_issues: []
---

# 84 — Language — @read-frontmatter and @update-frontmatter Directives

## Purpose

`@read-frontmatter` and `@update-frontmatter` give documents direct access to
the YAML frontmatter blocks of other markdown files. `@read-frontmatter` extracts
a field value for use in interpolation; `@update-frontmatter` modifies a field
in place.

Together they make it possible to build documents that query and maintain
frontmatter state across a file collection - useful for MDD workflow automation,
status dashboards, and doc synchronisation scripts.

## Architecture

**Parser — `packages/parser/src/directives/read-frontmatter.ts`**

Parses the inline directive line and returns a `ReadFrontmatterNode` with:
- `path: string` - file to read
- `field: string` - YAML field name
- `label?: string` - optional variable name; if absent the value is inlined

**Parser — `packages/parser/src/directives/update-frontmatter.ts`**

Parses the inline directive line and returns an `UpdateFrontmatterNode` with:
- `path: string` - file to update
- `field: string` - YAML field name
- `value: string` - new value to write

**Engine — `packages/engine/src/read-ops.ts`**

`executeReadFrontmatter(node, ctx)`:
1. Validates path through the data jail (read-side)
2. Reads the file and extracts the YAML frontmatter block (between `---` delimiters)
3. Resolves the requested field — scalar or list values both supported
4. If `label` is set: stores in `ctx.envFiles[label]`; otherwise returns value inline

**Engine — `packages/engine/src/write-ops.ts`**

`executeUpdateFrontmatter(node, ctx)`:
1. Validates path through the write jail
2. Reads the file, locates the frontmatter block
3. Replaces the target field value with a single regex pass
4. Writes the file back — idempotent (writing the same value is a no-op)

**Shared — `packages/engine/src/frontmatter-utils.ts`**

Shared helpers used by both read and write operations:
- `parseFrontmatter(content)` — extracts the YAML block between `---` delimiters
- `setFrontmatterField(content, field, value)` — in-place field replacement

## Data Model

No persistence. Both are AST nodes only.

```typescript
interface ReadFrontmatterNode extends ASTNodeBase {
  type: 'read-frontmatter'
  path: string
  field: string
  label?: string
}

interface UpdateFrontmatterNode extends ASTNodeBase {
  type: 'update-frontmatter'
  path: string
  field: string
  value: string
}
```

## API Endpoints

None. Language directives only.

## Business Rules

**@read-frontmatter syntax:**
```
@read-frontmatter path=".mdd/docs/01-parser.md" field="status"

@read-frontmatter path=".mdd/docs/01-parser.md" field="tags" label=parserTags
```

- Without `label`: value is inlined at the directive position in output
- With `label`: value stored in `ctx.envFiles[label]`, available as `{{ label }}`
- List fields (e.g. `tags: [a, b, c]`) are returned as a comma-separated string
- Missing field returns empty string (no error)
- Missing file (after jail check) returns empty string

**@update-frontmatter syntax:**
```
@update-frontmatter path=".mdd/docs/01-parser.md" field="status" value="complete"

@update-frontmatter path=".mdd/docs/01-parser.md" field="last_synced" value="2026-05-24"
```

- Idempotent: running twice with the same value produces no observable change
- Only scalar fields are supported for writes (not list fields)
- Creates the field if absent, updates it if present
- Does not touch any other frontmatter fields or document body

**List-addressed variant (wave5-A):**
`@update-frontmatter` supports a list-item addressing syntax for appending to or
replacing items in YAML list fields. See the wave5-A commit for syntax details.

**Security:**
Both directives are gated by the data jail (read) and write jail (write). Paths
are resolved relative to `ctx.cwd`. Symlinks that escape the jail are rejected.

## Data Flow

**@read-frontmatter:**
`ReadFrontmatterNode` at execution → jail check → `fs.readFile` → `parseFrontmatter()`
→ field extraction → either stored in `ctx.envFiles` or returned as inline string.

**@update-frontmatter:**
`UpdateFrontmatterNode` at execution → jail check → `fs.readFile` → `parseFrontmatter()`
→ `setFrontmatterField()` → `fs.writeFile` with updated content.

## Dependencies

- `01-parser`: node types are part of the `ASTNode` union
- `03-engine`: execution wired into `walkNode` switch
- `09-lang-file-resolution`: path resolution and jail enforcement at runtime
- `23-security-filesystem`: data jail and write jail checks applied before all file I/O
- `83-lang-foreach-set`: `@read-frontmatter` is a valid source expression for `@foreach`

## Security

All file access goes through the engine's jail checks. Paths cannot escape the
document root. `@update-frontmatter` is limited to the write jail scope. The
regex used for field replacement operates on the raw file string and does not
execute any expressions.

## Known Issues

(none yet)
