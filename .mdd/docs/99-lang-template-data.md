---
id: 99-lang-template-data
title: Language - @template and @data Directives (Reusable Partials with Bound Data)
edition: "@markdownai/parser, @markdownai/engine"
depends_on: [01-parser, 03-engine, 06-lang-interpolation, 08-lang-macros, 09-lang-file-resolution, 10-lang-include, 23-security-filesystem]
relates: [83-lang-foreach-set, 85-lang-render-template, 11-lang-import]
source_files:
  - packages/parser/src/directives/template.ts
  - packages/parser/src/directives/data.ts
  - packages/parser/src/types.ts
  - packages/parser/src/registry.ts
  - packages/engine/src/engine.ts
  - packages/engine/src/engine-template.ts
  - packages/engine/src/stripper.ts
  - packages/vscode/src/providers/completion-provider.ts
  - packages/vscode/src/providers/diagnostics-engine.ts
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/template.test.ts
  - packages/parser/src/__tests__/data.test.ts
  - packages/engine/src/__tests__/template.test.ts
  - packages/engine/src/__tests__/data.test.ts
  - packages/engine/src/__tests__/template-foreach.test.ts
  - packages/engine/src/__tests__/template-security.test.ts
data_flow: greenfield
last_synced: 2026-05-28
status: complete
phase: all
mdd_version: 11
tags: [template, data, partial, composition, scope-binding, language, directive]
path: Language/Templates
initiative: markdownai-templating
wave: markdownai-templating-wave-1
wave_status: complete
integration_contracts: []
satisfies_contracts:
  - from: 23-security-filesystem
    function: checkSourcePath(full, sourceJail, ctx.security.allowedSourcePaths, ctx.security.filesystemConfig)
    when: before any readFileSync in executeTemplate
    status: done
    verified_at: "packages/engine/src/engine-template.ts:91"
security_read_sites:
  - packages/engine/src/engine-template.ts:executeTemplate
known_issues: []
sister_projects: []
---

# 99 - Language - @template and @data Directives

## Purpose

`@template` and `@data` add reusable partials with explicit data binding to MarkdownAI documents.

`@template` inlines another `.md` file at the call site - same execution path as `@include`, every directive works inside it - but adds a `data=<expression>` binding so the partial can be rendered against any source the caller chooses. Inside the partial, the bound value is always available as `{{ data.* }}`.

`@data <name>` builds a composite object from any expressions in the current scope - `@db` results, `@set` variables, `@env` fallbacks, literals - and stores it under `<name>` so the same composite can feed multiple template renders.

Together they let a document declare a reusable rendered fragment and pass it data the way Angular/Vue templates bind to a context object, while keeping MarkdownAI's existing file resolution, security, and scope rules.

## Architecture

Two parser modules, one shared engine executor, full participation in the existing file-resolution and security model.

```
@data myReport                   @template ./report.md data=myReport /
  users = users                      |
  orders = orders                    +-- parser: parse path + data + as attrs -> TemplateNode
  site.name = siteName               |
@data-end                            +-- engine: checkFilePath -> readFileSync -> parse
   |                                 |             -> walk in forked ctx with data bound
   +-- parser: parse body            |
   |   key=expr / ...expr pairs      +-- output: rendered content inlined at call site
   +-- engine: evaluate each
       entry in order, build object,
       store in ctx as `myReport`
```

**v2 syntax conventions:** every directive in MarkdownAI v2 closes one of two ways. Single-line directives self-close with a trailing ` /` on the opener line (e.g. `@include ./shared.md /`, `@set x = 1 /`). Block directives close with `@<name>-end` at the same indent as the opener (e.g. `@foreach`/`@foreach-end`, `@phase`/`@phase-end`). The v1 `@end` / `@endif` / `@endswitch` tags are rejected with a ParseError. `@template` is single-line and uses ` /`; `@data` is a block and uses `@data-end`.

**Parser - `packages/parser/src/directives/data.ts`** parses the block opener `@data <name>`, captures body lines of the form `<key> = <expression>` or `...<expression>`, and produces a `DataNode`. The directive's name is added to `PARAM_BODY_DIRECTIVES` in `parser.ts` (joining `render-template`) so the parser collects body lines verbatim until `@data-end` rather than recursively re-parsing them as nodes.

**Parser - `packages/parser/src/directives/template.ts`** parses `@template <path> [data=<expression>] [as=<name>]`. Single-line directive - the parser sees a trailing ` /` on the opener and returns a self-closed node with no body. Path follows the same rules as `@include` (relative only, no absolute, no `..` traversal). Returns a `TemplateNode`.

**Engine - `packages/engine/src/engine-template.ts`** is a new module that mirrors `engine-include.ts`. It owns `executeTemplate(node, ctx, walkNodes)` and `executeData(node, ctx)`. Both share the existing `evaluateSource` dispatcher used by `@set` / `@foreach` for RHS evaluation.

**Engine dispatch** - `packages/engine/src/engine.ts` adds two new cases to its node switch (`'template'` and `'data'`) delegating to the new module.

**Stripper** - `packages/engine/src/stripper.ts` handles both new node types so `mai strip` produces clean markdown.

## Data Model

No persistence. Both directives are AST nodes only.

```typescript
interface TemplateNode extends ASTNodeBase {
  type: 'template'
  path: string                  // relative path to the partial
  dataExpr: string | null       // raw expression text for the data= binding, or null
  asName: string                // local name inside the partial; defaults to 'data'
  condition: string | null      // optional if= condition, same shape as IncludeNode
  cache: CacheModifier | null   // optional @cache modifier, same shape as IncludeNode
}

interface DataNode extends ASTNodeBase {
  type: 'data'
  name: string                  // composite variable name
  entries: DataEntry[]          // ordered key=expression pairs and spread entries
}

type DataEntry = DataAssignEntry | DataSpreadEntry

interface DataAssignEntry {
  kind: 'assign'
  key: string[]                 // ['site', 'name'] for `site.name = ...`
  rhs: string                   // raw expression text, evaluated by evaluateSource
  line: number                  // source line for error reporting
}

interface DataSpreadEntry {
  kind: 'spread'
  rhs: string                   // raw expression text for `...<expression>`, evaluated by evaluateSource
  line: number
}
```

Runtime representation of a composed `@data` object is `Record<string, unknown>` with nested objects produced from dot-notation keys.

## Business Rules

**@data syntax and semantics:**

```
@data myReport
  ...baseConfig
  users = users
  orders = orders
  site.name = siteName
  site.theme = "dark"
@data-end
```

- Block opener: `@data <name>` where `<name>` matches `[A-Za-z_][A-Za-z0-9_]*`. Close tag: `@data-end` at the same indent as the opener.
- Body lines come in two shapes: **assignments** (`<key> = <expression>`) and **spreads** (`...<expression>`). Blank lines and lines starting with `#` are ignored.
- Key supports dot notation. `site.name = X` and `site.theme = Y` together produce `{ site: { name: X, theme: Y } }`.
- RHS is evaluated using the same `evaluateSource` dispatcher as `@set` and `@foreach` - so any directive call, interpolation, or literal that works on the RHS of `@set` works here.
- **Spread** (`...<expression>`) evaluates the expression, which must resolve to an object, deep-clones it, and deep-merges its fields into the result at that point. Spread of a non-object value (string, number, null, undefined) logs a WARN and skips that entry. The deep clone prevents writes inside the `@data` block from leaking back into the source object.
- Multiple spreads are allowed. `...a` followed by `...b` deep-merges b on top of a (b wins on shared keys). Subsequent `key = value` assignments override either.
- Within a single `@data` block, both assignments and spreads contribute to a deep-merged object. Writing `site.name = "Acme"` after a spread that already contributed `{ site: { theme: 'light' } }` produces `{ site: { name: 'Acme', theme: 'light' } }`. Later writes to the same nested path overwrite earlier ones, but unrelated sibling fields are preserved.
- The resulting object is stored in `ctx.envFiles[name]` (same namespace as `@set` / `@env`), so `{{ name }}` interpolation, `@if`, `@foreach in @data`, and `data=name` on `@template` all see it.
- Re-declaring an existing `@data` name in the same scope overwrites the previous value (same as `@set`).
- An RHS that fails to evaluate logs a WARN, sets the entry to the empty string (for assignments) or skips (for spreads), and continues - matching the existing `{{ }}` interpolation behavior. No half-built object is stored; remaining entries still execute.

**@template syntax and semantics:**

```
@template ./report.md /
@template ./report.md data=myReport /
@template ./row.md data=row as=user /
@template ./report.md data=row if env.VERBOSE /
@template ./report.md data=row @cache session /
```

- Single-line directive - the opener line MUST end with a trailing ` /` to self-close per the v2 syntax convention. An opener without ` /` is treated as a block opener and the parser will look for `@template-end`; if absent, parsing fails with "Unclosed block - expected @template-end". The block form is reserved for a possible v2 extension and not used in v1 of this feature.
- The path is the first positional argument or `path="..."` attribute, same rules as `@include` (relative only, absolute and `..` traversal raise `ParseError` at parse time).
- `data=<expression>` is optional. The expression is evaluated against the caller's current scope at execution time. If the data attribute is omitted, `{{ data }}` inside the partial resolves to undefined (same warn-and-empty behavior as any unresolved interpolation).
- `as=<name>` is optional. When provided, the bound value is exposed inside the partial under that name instead of `data` (e.g. `as=row` makes the binding accessible as `{{ row.* }}`). The name must match `[A-Za-z_][A-Za-z0-9_]*`. Default is `data`. Useful when a partial calls another partial and both want a `data` binding for their own respective inputs, or when domain-specific names read better than the generic `data`.
- `if <expression>` and `if="<expression>"` follow `@include`'s shape exactly. False condition produces no output.
- `@cache session|persist|ttl|mock` as the last token is forwarded to the engine's cache layer the same way `@include` forwards it.
- Inside the partial, the bound value is accessible under whichever name was chosen (default `data`). Field access (`{{ data.users }}`, `{{ data.site.name }}`, `{{ row.id }}`) and the existing `?.` optional-chain operator work as in any other interpolation expression.
- The partial is parsed as a full MarkdownAI document. Every directive that works in a top-level document - `@db`, `@set`, `@foreach`, `@if`, `@list`, `@read`, `@http`, `@phase`, etc. - works inside the partial. The partial must start with `@markdownai` (or have it after frontmatter) to be recognized; a partial without the header produces an empty render and a WARN, matching `@include`.

**Scope model:**

- **Reads inherit:** the partial sees the caller's `ctx.envFiles` (set values), `ctx.connections` (registered `@connect` names), macros, env fallbacks, and any other context fields. This means `{{ siteName }}` works inside the partial if `siteName` was set above in the caller, and `@db users from=mainDb` works because the `mainDb` connection is visible.
- **Writes are sandboxed:** any `@define`, `@connect`, `@env`, or `@set` executed *inside* the partial stays local to the partial render. They do NOT bubble up to the caller. This is the deliberate difference from `@include`'s bubble-up behavior, and the reason `@template` is safe to call repeatedly (e.g., inside `@foreach`) without collision.
- **`@import` inside the partial** still works for pulling in shared definitions; those definitions are local to the partial render, consistent with the sandbox rule.
- **Bound name takes precedence:** the partial's local binding (default `data`, or whatever `as=` specifies) is stamped into the forked context after the inherit step, so it always wins over any caller variable of the same name. The caller's value is unaffected and is visible again to any code after the `@template` call (since writes are sandboxed). If `data=` is omitted, the bound name resolves to undefined - the caller's variable of that name is NOT inherited.

**Composition with @foreach:**

```
@db users from=mainDb query="SELECT id, name FROM users" label=users /

@foreach row in {{ users }}
  @template ./user-card.md data=row /
@foreach-end
```

- `@foreach` already saves and restores the iteration variable around the loop body. `@template data=row` evaluates `row` in the loop body's scope, gets the current row, and binds it to `{{ data }}` inside the partial. No special wiring required.
- Same composition works with `@data`: build a composite once, then `@template` against it many times in a loop where one of the loop variables is a slice of the composite.

**Composition with @data:**

```
@db users from=mainDb query="SELECT * FROM users" label=users /
@db orders from=mainDb query="SELECT * FROM orders" label=orders /
@set siteName = "Acme" /

@data myReport
  users = users
  orders = orders
  site.name = siteName
  site.theme = "dark"
@data-end

@template ./report.md data=myReport /
@template ./email-version.md data=myReport /
```

- `@data` builds the composite once. Multiple `@template` calls reuse the same composite.
- The composite is just an object in `ctx.envFiles` - it can also be referenced by `{{ myReport.site.name }}` outside any template call.

**Cross-cutting rules (apply to both directives):**

- **File resolution:** `@template` participates in the same `resolutionStack` / `completedSet` as `@include` and `@import`. A partial that references itself - directly or via a chain - produces the standard circular-reference fatal error with the full chain printed. Diamond inclusion is allowed (the same partial can be rendered many times, each render is independent).
- **Filesystem confinement:** `@template`'s file read goes through `checkFilePath(resolved, ctx.jailRoot, ctx.security)` before `readFileSync`, satisfying contract `23-security-filesystem` for any new file-read site. Blocked paths raise `FatalError`; alert-level paths add to `ctx.warnings`.
- **Content masking:** the file content read by `@template` passes through the same masking pipeline as `@include` / `@read` before parsing - secrets in the partial file are masked before the parser sees them, so they cannot leak into rendered output.
- **Cache modifier:** `@cache` on `@template` keys the cache on the resolved path AND the JSON-stringified bound data, so different `data=` values render distinctly even at the same path. This matters most for `persist` and `ttl` modes.
- **Strip mode:** `mai strip` removes `@data` blocks entirely (no equivalent plain-markdown output) and resolves `@template` calls inline by reading the partial and substituting `{{ data.* }}` references with the bound value if known, or leaving placeholders if not. Strip mode never executes other directives, so a partial that uses `@db` strips to its raw body with `@db` lines removed - same rule as elsewhere.

**Parse-time errors (ParseError, no execution):**

- `@template` with absolute path -> `@template does not allow absolute paths (filesystem confinement)`
- `@template` with `..` traversal in path -> `@template does not allow path traversal (..)`
- `@template` with neither path nor `path=` attribute -> `@template requires a path`
- `@template` with `as=<name>` where `<name>` does not match `[A-Za-z_][A-Za-z0-9_]*` -> `@template as= must match [A-Za-z_][A-Za-z0-9_]*`
- `@template` opener without trailing ` /` and no matching `@template-end` -> standard parser error `Unclosed block - expected @template-end` (raised by `collectBlock`, not by the directive module)
- `@data` with no name -> `@data requires a variable name`
- `@data` with an invalid name (does not match identifier regex) -> `@data name must match [A-Za-z_][A-Za-z0-9_]*`
- `@data` block missing `@data-end` -> standard parser error `Unclosed block - expected @data-end`
- `@data` body line that is non-blank, non-comment, contains no `=`, and does not start with `...` -> `@data body lines must be <key> = <expression> or ...<expression>`
- `@data` body containing legacy `@end` -> the parser's v1-close-tag rejection fires first with `v1 close tag "@end" not accepted in v2 - use "@data-end" instead`

**Runtime warnings (WARN, render continues):**

- `@template` target file unreadable - same path-redaction behavior as `@include` (`@template: cannot read file "<path>": <err>`).
- `@template` target file has no `@markdownai` header - same as `@include` (empty render, warning).
- `@data` entry RHS fails to evaluate - WARN, entry set to empty string, remaining entries continue.
- `@template` with `data=<expr>` where the expression evaluates to undefined - bind `data` to undefined, no WARN (matches `{{ env.UNSET }}` behavior). Inside the partial, `{{ data.x }}` then resolves to empty string with a WARN per the existing interpolation rules.

## Data Flow

Greenfield directives - no existing UI values to trace. The end-to-end runtime flow:

**@data:**
1. Parser sees `@data myReport` opener, captures body lines until `@data-end`, produces `DataNode { name: 'myReport', entries: [...] }` where each entry is either a `DataAssignEntry` (key path + rhs) or a `DataSpreadEntry` (rhs only).
2. Engine `executeData` iterates entries in declaration order. For each: evaluate `rhs` via `evaluateSource(rhs, ctx)`. Assignment entries walk the `key` array - for `['site', 'name']` ensure `result.site` exists as an object, then set `result.site.name = value`. Spread entries call `Object.assign(result, rhsValue)` if the value is an object; otherwise WARN and skip.
3. Store `result` in `ctx.envFiles['myReport']`. Return empty string (no inline output).

**@template:**
1. Parser sees the self-closed line `@template ./report.md data=myReport /` and produces `TemplateNode { path: './report.md', dataExpr: 'myReport', asName: 'data', condition: null, cache: null }`. (With `as=row`, `asName` is `'row'`.)
2. Engine `executeTemplate` evaluates `condition` - skip if false.
3. Evaluate `dataExpr` via `evaluateSource(dataExpr, ctx)` against the caller's scope.
4. Resolve the path against `ctx.docDir`, then call `checkFilePath(resolved, jailRoot, ctx.security)`. Blocked -> FatalError. Alert -> push warning, continue.
5. Check `ctx.resolutionStack` for circularity. Cycle -> FatalError with chain.
6. `readFileSync` -> parse via `parse(source, { filePath: full })`. No header -> WARN, return empty.
7. Build a forked context: copy ctx but override `docDir`, set `phase: null`, and stamp `asName` in `envFiles` to the value evaluated in step 3 (default `asName` is `'data'`; `as=row` makes it `'row'`). The forked context inherits the parent's existing connections and macros (read-only - any new ones added by the partial stay in the forked copy).
8. `walkNodesFn(ast.nodes, forkedCtx)` - same call pattern as `executeInclude`, returns the rendered string.
9. Return that string. Caller's context is untouched aside from `resolutionStack` and `completedSet` housekeeping (which match the include behavior).

## Dependencies

- `01-parser`: `TemplateNode` and `DataNode` are added to the `ASTNode` union. New directive modules are registered in `registry.ts`.
- `03-engine`: provides `walkNodes`, `evaluateSource`, the resolution-stack / completed-set bookkeeping, and the cache layer. `engine-template.ts` is wired into the engine's node-dispatch switch.
- `06-lang-interpolation`: `{{ data.field }}` and `{{ data?.field }}` use the existing interpolation evaluator - no new expression syntax is introduced.
- `08-lang-macros`: macros defined in the caller are visible inside the partial via the inherited ctx. The partial's own `@define` calls land in the forked ctx only.
- `09-lang-file-resolution`: `@template` participates in `resolutionStack` and `completedSet` exactly like `@include` (each render of the same path is independent).
- `10-lang-include`: shared mental model. `engine-template.ts` is patterned after `engine-include.ts`; small helpers (path expansion, condition evaluation) may be extracted to a shared module if both call sites need them.
- `23-security-filesystem`: `executeTemplate` MUST call `checkFilePath` before any `readFileSync`. This satisfies the file-read contract for the new directive (entry added to `satisfies_contracts`).

## Security

`@template` is a new file-reading directive. The threat model and required controls are identical to `@include`:

- **Untrusted input:** the path argument is author-controlled in normal use, but `data=` may carry values that came from `@db`, `@http`, `@read`, or other external sources. Those values are inserted into the partial's interpolation context only - they are NOT used to construct further file paths, shell commands, or HTTP URLs by the template directive itself. Anything the partial does with the bound data (e.g. piping `data.path` into another `@include`) is governed by that directive's own security gates.
- **Confinement (mandatory):** `checkFilePath(resolved, ctx.jailRoot, ctx.security)` runs before `readFileSync`. Absolute paths and `..` traversal are blocked at parse time; runtime then blocks any path resolving outside the source jail. Built-in always-block paths and patterns (`~/.ssh/*`, `*.env`, `*.pem`, etc.) cannot be bypassed.
- **Content masking (mandatory):** the partial file's content passes through the masking pipeline before parsing. Credentials embedded in a partial cannot leak through `@template` even if confinement allows the file.
- **Cache safety:** content masking runs before caching, matching the rule for `@include` / `@read` - sensitive values are never stored in the session or persistent cache.
- **No shell, no network:** neither directive spawns processes or makes network calls on its own.

`@data` makes no filesystem or network calls of its own - it only evaluates RHS expressions through the existing `evaluateSource` dispatcher, which routes each sub-directive (`@db`, `@http`, `@read`, etc.) through its own security gate. No new attack surface.

**Threat model for MCP / external callers:** an MCP client cannot construct a `@template` call against an arbitrary file because all paths are resolved relative to the document being rendered, and the source jail constrains where rendering can read from. The `data=` expression is evaluated within MarkdownAI's expression engine, which already disallows arbitrary code execution.

## Known Issues

(none yet - will be populated by audits as the feature is implemented)

## Bugs

(none yet - populated by /mdd bug when issues are reported)
