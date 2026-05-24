---
id: 88-lang-write-directives
title: Language — Write Directives (@mkdir, @copy, @append-if-missing)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 09-lang-file-resolution, 23-security-filesystem]
relates: [84-lang-frontmatter-ops, 85-lang-render-template]
source_files:
  - packages/parser/src/directives/mkdir.ts
  - packages/parser/src/directives/copy.ts
  - packages/parser/src/directives/append-if-missing.ts
  - packages/engine/src/write-ops.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/write-ops.test.ts
data_flow: writes-existing
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [mkdir, copy, append, write, filesystem, directive, language, scaffold]
path: Language/Write
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/write-ops.ts
known_issues: []
---

# 88 — Language — Write Directives

## Purpose

`@mkdir`, `@copy`, and `@append-if-missing` are the three filesystem write
directives added in wave 3. They give MarkdownAI documents the ability to create
directories, copy files, and idempotently append content to files - all without
leaving markdown syntax and all subject to the engine's write jail.

These directives are designed for bootstrap and scaffold workflows where a
document needs to provision a directory structure or seed configuration files.

## Architecture

**Parser — `packages/parser/src/directives/mkdir.ts`**

Returns a `MkdirNode` with:
- `path: string` - directory path (named or first positional argument)
- `recursive: boolean` - whether to create parent directories (default: `true`)

**Parser — `packages/parser/src/directives/copy.ts`**

Returns a `CopyNode` with:
- `from: string` - source file path (supports `${CLAUDE_SKILL_DIR}` expansion)
- `to: string` - destination file path
- `ifMissing: boolean` - only copy if destination does not exist

**Parser — `packages/parser/src/directives/append-if-missing.ts`**

Returns an `AppendIfMissingNode` with:
- `path: string` - file to append to
- `text: string` - content to append

**Engine — `packages/engine/src/write-ops.ts`**

All three directives are executed here, each jail-checked before any I/O:

`executeMkdir(node, ctx)`:
- Resolves path through write jail
- Calls `fs.mkdir(path, { recursive: node.recursive })`
- No-op if directory already exists

`executeCopy(node, ctx)`:
- Expands `${CLAUDE_SKILL_DIR}` and other env vars in `from` path
- Resolves both paths through write jail
- Checks destination existence if `ifMissing` is set
- Calls `fs.copyFile(from, to)` if conditions are met

`executeAppendIfMissing(node, ctx)`:
- Resolves path through write jail
- Reads current file content (empty string if file does not exist)
- Checks if `text` is already present (substring match)
- Appends `\n<text>` only if not found

## Data Model

No persistence. All are AST nodes only.

```typescript
interface MkdirNode extends ASTNodeBase {
  type: 'mkdir'
  path: string
  recursive: boolean
}

interface CopyNode extends ASTNodeBase {
  type: 'copy'
  from: string
  to: string
  ifMissing: boolean
}

interface AppendIfMissingNode extends ASTNodeBase {
  type: 'append-if-missing'
  path: string
  text: string
}
```

## API Endpoints

None. Language directives only.

## Business Rules

**@mkdir syntax:**
```
@mkdir path=".mdd/docs"
@mkdir .mdd/audits
@mkdir path="output/reports" recursive=false
```

- `path` can be named (`path="..."`) or the first positional token
- `recursive=true` is the default
- Calling `@mkdir` on an existing directory is a no-op

**@copy syntax:**
```
@copy from="${CLAUDE_SKILL_DIR}/templates/hook.ts" to="./hooks/post-commit.ts"
@copy from="src/config.example.json" to="src/config.json" if-missing
```

- `from` supports `${CLAUDE_SKILL_DIR}`, `${HOME}`, and other env vars
- `if-missing` flag: skip the copy if destination already exists (idempotent)
- Without `if-missing`: always copies (overwrites existing destination)
- Both paths are resolved through the write jail after env expansion

**@append-if-missing syntax:**
```
@append-if-missing path=".gitignore" text=".env"
@append-if-missing path=".gitignore" text=".mdd/audits/"
```

- Appends only if the text does not already appear anywhere in the file
- The check is a simple substring match (not line-by-line)
- Creates the file if it does not exist
- Appends with a leading newline to avoid joining with the last line

**Common use cases:**
- Bootstrap `.gitignore` entries
- Create directory trees during project init
- Copy template files to project roots idempotently

## Data Flow

Each directive parsed as its respective AST node. At execution: write jail
check → conditional checks → filesystem operation. All operations are atomic
at the file level (no partial writes).

## Dependencies

- `01-parser`: node types in the `ASTNode` union
- `03-engine`: execution wired into `walkNode` switch via write-ops.ts
- `09-lang-file-resolution`: path resolution and jail enforcement
- `23-security-filesystem`: write jail checks applied before all file I/O

## Security

All three directives are gated by the write jail. Paths cannot escape the
configured write root. `@copy` additionally expands env vars in the `from`
path - expansion is limited to known env var syntax and the resolved path is
jail-checked after expansion. `@append-if-missing` creates files if absent,
which is intentional for bootstrap use cases but means the write jail scope
must be configured correctly before allowing these directives in untrusted
documents.

## Known Issues

(none yet)
