---
id: 50-match-operator
title: match Operator - Regex Matching in Expressions
edition: Both
status: complete
path: engine/conditions
source_files:
  - packages/engine/src/conditions.ts
  - packages/engine/src/__tests__/conditions.test.ts
depends_on:
  - 03-engine
last_synced: 2026-05-17
tags: [expression-system, conditions, regex, match, preprocessor]
known_issues: []
mdd_version: 2
---

## Purpose

Adds `match` as a first-class infix operator in the MarkdownAI expression system. Instead of reaching for JS regex syntax inside an `@if` condition, authors write:

```markdown
@if {{ current_branch }} match "^feat"
Working on a feature branch.
@endif
```

The operator sits alongside `file.exists`, `file.isFile`, and `file.isDir` as MarkdownAI-specific sugar that makes document conditions read as documentation.

## Syntax

```
<value> match "<pattern>"
<value> match '<pattern>'
```

- `<value>` - an env var name (`BRANCH`), a dotted path (`env.BRANCH`), or a `{{ }}` interpolation
- `<pattern>` - a regex pattern string (no surrounding slashes)

The preprocessor converts this to `new RegExp("pattern").test(value)` before the expression is evaluated by `vm.runInNewContext`. The pattern is passed through `JSON.stringify` so backslash sequences survive the conversion correctly.

## Examples

### Branch-based dispatch

```markdown
@markdownai
@call git-branch

@if {{ current_branch }} match "^feat"
This is a feature branch - proceed with feature workflow.
@endif

@if {{ current_branch }} match "^fix"
This is a bugfix branch - run regression checks first.
@endif

@if {{ current_branch }} match "^(main|master)$"
@constraint You are on the main branch. Create a feature branch before making changes.
@endif
```

### Version checks

```markdown
@markdownai
@call env-node

@if {{ node_version }} match "^v(18|20|22)"
Node version is compatible.
@else
@constraint Requires Node 18, 20, or 22. Current: {{ node_version }}
@endif
```

### Negation

Use `!()` grouping to negate:

```markdown
@if !({{ current_branch }} match "^feat")
Not a feature branch.
@endif
```

### Combined with && and ||

```markdown
@if {{ current_branch }} match "^feat" && {{ node_version }} match "^v20"
Feature branch on Node 20 - all checks pass.
@endif

@if {{ current_branch }} match "^fix" || {{ current_branch }} match "^hotfix"
Bugfix or hotfix - abbreviated workflow applies.
@endif
```

### ARGUMENTS dispatch in skills

```markdown
@if ARGUMENTS match "^audit"
Run audit workflow...
@endif
```

## Implementation

`preprocessExpr()` in `conditions.ts` converts the infix syntax to valid JavaScript before the expression reaches `vm.runInNewContext`:

```typescript
result = result
  .replace(/("[^"]*"|'[^']*'|[A-Za-z_$][A-Za-z0-9_.$]*)\s+\bmatch\b\s+"([^"]*)"/g,
    (_, lhs, pat) => `new RegExp(${JSON.stringify(pat)}).test(${lhs})`)
  .replace(/("[^"]*"|'[^']*'|[A-Za-z_$][A-Za-z0-9_.$]*)\s+\bmatch\b\s+'([^']*)'/g,
    (_, lhs, pat) => `new RegExp(${JSON.stringify(pat)}).test(${lhs})`)
```

The LHS pattern covers:
- `"..."` or `'...'` - quoted strings produced by `{{ }}` expansion in `evalCondition`
- `[A-Za-z_$][A-Za-z0-9_.$]*` - identifiers and dotted paths like `env.BRANCH`

`new RegExp(JSON.stringify(pat))` is used rather than a regex literal so that patterns containing `/` work without escaping and backslash sequences survive the string-to-RegExp conversion correctly.

## Scope

The transform runs in `preprocessExpr`, which is called from `runExpr`. Since both `evalCondition` (used by `@if`) and `evalExpression` (used by `{{ }}` interpolation) go through `runExpr`, `match` works in both contexts:

- `@if {{ branch }} match "^feat"` - conditional blocks
- `{{ BRANCH match "^feat" }}` - outputs "true" or "false" in text

The `where` clauses on `@list`, `@read`, and `@db` also go through the same evaluation path.

## Unset variables

`{{ UNSET_VAR }}` expands to `""` in `evalCondition`. `"" match "^feat"` returns `false`. No error, no warning - consistent with how other operators handle unset variables.
