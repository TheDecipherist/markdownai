---
id: 87-lang-hash
title: Language — @hash Directive (Content Verification)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 09-lang-file-resolution, 23-security-filesystem]
relates: [15-lang-sources-read, 84-lang-frontmatter-ops, 86-lang-test-check]
source_files:
  - packages/parser/src/directives/hash.ts
  - packages/engine/src/read-ops.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/hash.test.ts
data_flow: reads-existing
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [hash, sha256, checksum, content, verification, directive, language, integrity]
path: Language/Verification
integration_contracts: []
satisfies_contracts: []
security_read_sites:
  - packages/engine/src/read-ops.ts
known_issues: []
---

# 87 — Language — @hash Directive

## Purpose

`@hash` computes a cryptographic hash of a file's contents and inlines the
result into the document. It supports multiple algorithms, output truncation,
and line exclusion - making it useful for integrity verification, self-referencing
content hashes in frontmatter, and document fingerprinting workflows.

The `exclude-line` option is particularly important for self-referencing use
cases: a file can hash itself while excluding the line that contains the hash
field, ensuring stable re-computation.

## Architecture

**Parser — `packages/parser/src/directives/hash.ts`**

Parses the inline directive and returns a `HashNode` with:
- `path: string` - file to hash (required)
- `algo: string` - hash algorithm (default: `sha256`)
- `length?: number` - truncate hex digest to first N characters
- `excludeLine?: string` - regex pattern; matching lines removed before hashing
- `label?: string` - variable name for result storage

**Engine — `packages/engine/src/read-ops.ts`**

`executeHash(node, ctx)`:
1. Validates path through the data jail (read-only)
2. Reads file content
3. If `excludeLine` is set: filters out lines matching the regex before hashing
4. Computes digest using Node.js `crypto.createHash(algo)`
5. Truncates hex string to `length` characters if specified
6. If `label` is set: stores in `ctx.envFiles[label]`; otherwise returns inline

## Data Model

No persistence. `HashNode` is an AST node only.

```typescript
interface HashNode extends ASTNodeBase {
  type: 'hash'
  path: string
  algo: string
  length?: number
  excludeLine?: string
  label?: string
}
```

## API Endpoints

None. Language directive only.

## Business Rules

**Syntax:**
```
@hash path="src/core/engine.ts"

@hash path="src/core/engine.ts" algo=sha256

@hash path="src/core/engine.ts" algo=sha1 length=8

@hash path=".mdd/docs/01-parser.md" exclude-line="^hash:" label=docHash
```

**Supported algorithms:**
- `sha256` (default)
- `sha1`
- `md5`

Any algorithm supported by Node.js `crypto.createHash()` is accepted, but only
these three are officially supported.

**`length` option:**
Truncates the hex digest to the first N characters. `length=8` gives an 8-character
prefix suitable for compact identifiers (e.g. MDD doc hashes in frontmatter).

**`exclude-line` option:**
Lines whose full content matches the regex are removed from the content before
hashing. This enables self-referencing patterns:

```
# A document that records its own hash in frontmatter:
@update-frontmatter path="./this-doc.md" field="hash" value="@hash path='./this-doc.md' exclude-line='^hash:' length=8"
```

Without `exclude-line`, the hash field itself would change every time the hash
is recomputed, causing an infinite loop.

**Security:**
Path is validated through the data jail before any file read. The `excludeLine`
regex is compiled with standard JS regex (no flags by default). If the regex is
invalid, the directive errors with the regex compilation error.

## Data Flow

Inline directive parsed → `HashNode`. At execution: jail check → file read →
optional line filtering → `crypto.createHash(algo).update(content).digest('hex')`
→ optional truncation → result stored or inlined.

## Dependencies

- `01-parser`: `HashNode` in the `ASTNode` union
- `03-engine`: execution wired into `walkNode` switch via read-ops.ts
- `09-lang-file-resolution`: path resolution and jail enforcement
- `23-security-filesystem`: data jail check before file read

## Security

File access is jail-checked. The directive is read-only. `excludeLine` regex
runs against local content only - no external evaluation.

## Known Issues

(none yet)
