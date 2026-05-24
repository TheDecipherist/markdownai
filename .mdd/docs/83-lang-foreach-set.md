---
id: 83-lang-foreach-set
title: Language — @foreach and @set Directives (Iteration and Variable Assignment)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 06-lang-interpolation, 08-lang-macros]
relates: [12-lang-conditionals, 14-lang-sources-list, 15-lang-sources-read]
source_files:
  - packages/parser/src/directives/foreach.ts
  - packages/parser/src/directives/set.ts
  - packages/engine/src/iter-ops.ts
routes: []
models: []
test_files:
  - packages/engine/src/__tests__/foreach.test.ts
  - packages/engine/src/__tests__/set.test.ts
data_flow: reads-existing
last_synced: 2026-05-24
status: draft
phase: reverse-engineered
mdd_version: 1
tags: [foreach, set, iteration, variable, loop, directive, language]
path: Language/Iteration
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
---

# 83 — Language — @foreach and @set Directives

## Purpose

`@foreach` and `@set` are the iteration and variable-assignment primitives for
MarkdownAI. Together they enable documents to loop over collections of data and
store computed values for later interpolation - turning static documents into
dynamic ones without leaving markdown syntax.

`@foreach` re-renders its body block once per item in a source expression.
`@set` binds a variable to an evaluated expression and makes it available via
`{{ var }}` interpolation anywhere later in the document.

## Architecture

**Parser — `packages/parser/src/directives/foreach.ts`**

Parses the `@foreach <var> in <source>` line and captures the block body up to
`@end`. Returns a `ForeachNode` with:
- `variable: string` - the iteration variable name (matches `[A-Za-z_][A-Za-z0-9_]*`)
- `source: string` - the raw source expression (directive ref, interpolation, or literal)
- `body: ASTNode[]` - parsed child nodes of the block body

**Parser — `packages/parser/src/directives/set.ts`**

Parses the `@set <var> = <rhs>` inline directive. Returns a `SetNode` with:
- `variable: string` - the variable name to bind
- `rhs: string` - the raw right-hand-side expression

**Engine — `packages/engine/src/iter-ops.ts`**

Implements execution for both directives. Key functions:

`executeForeach(node, ctx)`:
1. Calls `evaluateSource()` to resolve the source expression (sub-directive parse or interpolation)
2. Calls `splitItems()` to split the result into individual values (handles newlines, YAML-style `[a, b, c]` lists, commas, or single scalars)
3. For each item, calls `substituteParams()` to bind `{{ var }}` in the body AST
4. Re-walks the body AST with the bound variable, collecting output
5. Restores any previous binding of the same variable name after the loop

`executeSet(node, ctx)`:
1. Evaluates the RHS expression (sub-directive, interpolation, or literal)
2. Unquotes single-pair quoted strings for clean storage
3. Stores result in `ctx.envFiles[variable]` for later `{{ var }}` interpolation

`setIterEngine()` injects `walkNodes` and interpolation resolver callbacks from the
engine at startup, avoiding circular imports.

## Data Model

No persistence. `ForeachNode` and `SetNode` are AST nodes only.

```typescript
interface ForeachNode extends ASTNodeBase {
  type: 'foreach'
  variable: string
  source: string
  body: ASTNode[]
}

interface SetNode extends ASTNodeBase {
  type: 'set'
  variable: string
  rhs: string
}
```

## API Endpoints

None. Language directives only.

## Business Rules

**@foreach syntax:**
```
@foreach item in @list path="./items"
  - {{ item }}
@end

@foreach name in "Alice,Bob,Carol"
  Hello {{ name }}!
@end

@foreach entry in {{ myList }}
  Processing: {{ entry }}
@end
```

**@set syntax:**
```
@set count = @count path="./data"
@set title = "My Document"
@set version = {{ package.version }}
```

**Source types for @foreach:**
- Directive reference: `@list`, `@read`, `@read-frontmatter`, `@query` — evaluated at runtime
- Interpolation: `{{ varName }}` — resolved from context
- Comma-separated literal: `"a,b,c"` — split on commas
- Newline-separated output from any directive

**Item splitting rules (`splitItems`):**
1. If value matches YAML inline list `[a, b, c]` → split on `, `
2. If value contains newlines → split on `\n`
3. If value contains commas but no newlines → split on `,`
4. Otherwise → treat as single item

**Variable scoping:**
- `@set` binds into `ctx.envFiles` which is the same namespace as `@env` variables
- `@foreach` saves and restores previous binding of the iteration variable after the loop completes
- Variables set inside `@foreach` are visible in subsequent iterations (no isolation)
- Variable names are case-sensitive

## Data Flow

**@foreach:**
Source line parsed → `ForeachNode`. At execution: `evaluateSource()` resolves
the source (may involve sub-parsing a directive string), `splitItems()` splits,
then `substituteParams()` rebinds the body AST for each item before `walkNodes`.

**@set:**
Line parsed → `SetNode`. At execution: RHS evaluated (same `evaluateSource`
dispatcher as foreach), result stored in `ctx.envFiles`. Available immediately
to subsequent `{{ varName }}` interpolations in the document.

## Dependencies

- `01-parser`: `ForeachNode` and `SetNode` types are part of the `ASTNode` union
- `03-engine`: iter-ops injects `walkNodes` and interpolation resolver via `setIterEngine()`
- `06-lang-interpolation`: `{{ var }}` spans in the body are resolved through the same interpolation pipeline
- `08-lang-macros`: `substituteParams()` from macros.ts handles body-AST variable binding

## Security

`@foreach` and `@set` accept source expressions that can reference sub-directives.
Those sub-directives go through their own security gates (file jail, HTTP allowlist,
etc.) independently. `@set` with a literal value makes no filesystem or network
calls. Neither directive spawns shell processes on its own.

## Known Issues

(none yet)
