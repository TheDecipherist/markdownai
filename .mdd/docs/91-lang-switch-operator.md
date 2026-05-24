---
id: 91-lang-switch-operator
title: Language — @switch/@case/@default
edition: MarkdownAI
depends_on:
  - 12-lang-conditionals
  - 06-lang-interpolation
  - 47-skill-context-variables
  - 83-lang-foreach-set
  - 90-lang-dynamic-include-path
relates:
  - 12-lang-conditionals
  - 83-lang-foreach-set
source_files:
  - packages/parser/src/directives/switch.ts
  - packages/parser/src/types.ts
  - packages/parser/src/parser.ts
  - packages/parser/src/registry.ts
  - packages/engine/src/engine.ts
  - packages/vscode/syntaxes/markdownai.tmLanguage.json
  - packages/vscode/snippets/markdownai.code-snippets
routes: []
models: []
test_files:
  - packages/parser/src/__tests__/switch.test.ts
  - packages/engine/src/__tests__/switch.test.ts
data_flow: greenfield
last_synced: 2026-05-24
status: complete
phase: all
mdd_version: 1
tags: [switch, case, default, conditionals, expressions, arguments, foreach, language]
path: Language/Conditionals
integration_contracts: []
satisfies_contracts: []
security_read_sites: []
known_issues: []
sister_projects: []
---

# 91 — Language: @switch/@case/@default

## Purpose

Adds a `@switch` block directive that selects one of several content branches by evaluating an expression and comparing it against `@case` values. It mirrors JavaScript's switch statement but without fall-through: the first matching case wins and no explicit break is needed. Both the switch expression and each case value support `{{ }}` dynamic expressions, giving access to ARGUMENTS, env vars, foreach loop variables, and any other sandbox value.

## Architecture

The switch operator follows the same pattern as `@if`/`@elseif`:

- **Parser** (`switch.ts` + `parser.ts`): A `parseSwitchBlock` function walks lines after `@switch`, collecting `@case` branches and the optional `@default` body until `@endswitch`. Each `@case` stores its raw expression string. The resulting `SwitchNode` is added to the AST.
- **Types** (`types.ts`): `SwitchCase { caseExpression: string, body: ASTNode[] }` and `SwitchNode` are added; `SwitchNode` joins the `ASTNode` union.
- **Engine** (`engine.ts`): `handleSwitch` evaluates the switch expression to a string, then evaluates each case expression in order and compares with `===`. The first match has its body walked; the `@default` body is used if nothing matches. Returns `''` when there is no match and no default.

```
@switch {{ARGUMENTS[0] || 'default'}}    ← expression evaluated by evalSwitchValue()
  @case "hello"                           ← caseExpression "\"hello\"" → "hello"
    Hello branch
  @case {{ENV_STAGE}}                     ← caseExpression "ENV_STAGE" → env value
    Stage-specific branch
  @default
    Fallback
@endswitch
```

## Data Model

No database storage. The AST types are:

```typescript
export interface SwitchCase {
  caseExpression: string   // raw expression stored by parser; may contain {{ }}
  body: ASTNode[]
}

export interface SwitchNode extends ASTNodeBase {
  type: 'switch'
  expression: string       // raw expression after @switch keyword; may contain {{ }}
  cases: SwitchCase[]
  defaultBody: ASTNode[] | null
}
```

## API Endpoints

None. Pure parser + engine feature.

## Business Rules

1. **No fall-through.** The first case whose value matches the switch value is executed. Subsequent cases are skipped.

2. **Expression evaluation.** Both the switch expression and each case expression are evaluated with the same VM sandbox used by `evalCondition` and `evalExpression`. The helper `evalSwitchValue(expr, ctx)` pre-expands `{{ inner }}` patterns (evaluating `inner` and JSON-stringifying the result) then evaluates the outer expression, returning `String(result)` or `''` for undefined.

3. **String comparison.** After both sides are evaluated to strings, the match is `===`. Numbers and booleans are stringified before comparison (e.g., the number `1` matches `@case "1"`).

4. **No match, no default.** When nothing matches and `@default` is absent, the block produces empty output, silently. Same behaviour as `@if` with no matching branch.

5. **Empty switch expression.** If the expression evaluates to `undefined` or an error, the switch value is `''`. A `@case ""` would match it.

6. **`@default` is a keyword, not a value.** The text `"default"` as a case expression (`@case "default"`) matches the string `"default"` - it does NOT activate the `@default` block. The `@default` block is the structural fallback, independent of expression values.

7. **`@default` placement.** By convention `@default` should be last, but the parser accepts it anywhere. If a prior `@case` matched, `@default` is never reached.

8. **Nested `@switch`.** Fully supported. An `@switch` inside another `@switch`, inside `@foreach`, or inside `@if` works as expected because each block is self-contained in the AST.

9. **`@endswitch` closes the block.** The parser throws `ParseError` if end-of-file is reached inside a `@switch` without `@endswitch`.

10. **Template pattern matching.** The `{{ }}` pre-expansion regex uses `\s*` around the expression: `/\{\{\s*([\s\S]*?)\s*\}\}/g` - spec-valid forms with spaces are handled.

## Data Flow

Greenfield - no existing code paths are modified except additions.

Parse path: raw line `@switch {{expr}}` → `args = "{{expr}}"` stored as `expression` in `SwitchNode` → `@case {{val}}` args stored as `caseExpression` in each `SwitchCase`.

Execution path: `walkNode` dispatches `SwitchNode` → `handleSwitch` → `evalSwitchValue(node.expression, ctx)` → compare with `evalSwitchValue(c.caseExpression, ctx)` for each case → `walkNodes(matchedBody, ctx)` or `walkNodes(defaultBody, ctx)` or `''`.

## Dependencies

- `12-lang-conditionals` - `evalCondition` and `evalExpression` sandbox; `parseIfBlock` is the direct structural model.
- `06-lang-interpolation` - `{{ }}` syntax that users write in switch and case expressions.
- `47-skill-context-variables` - `ARGUMENTS`, `argsList`, named args available in the sandbox.
- `83-lang-foreach-set` - foreach loop variable (`{{ item }}`) is bound in context during iteration, so `@switch {{item}}` works inside `@foreach` without extra wiring.
- `90-lang-dynamic-include-path` - established the pattern for `{{ }}` pre-expansion in non-condition contexts; `evalSwitchValue` follows the same approach.

## Security

`@switch` accepts user-supplied expressions from document authors (not from untrusted external callers in the MCP threat model). Expressions run in the existing `vm.runInNewContext` sandbox with a 500 ms timeout, consistent with all other expression-bearing directives. No new attack surface beyond what `@if` already exposes.

No filesystem reads, no network calls, no process spawning. Document root confinement is not relevant here (no path resolution).

## Known Issues

(none yet)

## Bugs

(none yet — populated by /mdd bug when issues are reported)
