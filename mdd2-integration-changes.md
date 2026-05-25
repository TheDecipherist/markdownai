---
name: mdd2-integration-changes
purpose: Track authorized changes to MarkdownAI made in support of @thedecipherist/mdd2
---

@markdownai v2.0

# MarkdownAI Changes for @thedecipherist/mdd2

This document tracks the upstream MarkdownAI changes authorized under D30 of the
[mdd2 v2.0 architecture spec](../mdd2/MDs/mdd-version-2.0-spec.md). Per D30, any
mdd2 need that requires a MarkdownAI change is implemented here (on a feature
branch in this repo), documented in this file, and then pinned in mdd2's
`package.json`.

## 1.1.0 — Flow syntax extensions (2026-05-25)

Branch: `feat/mdd2-flow-syntax-extensions`

Need: mdd2's Wave 4 (Flows and Router) shipped 7 flow files + 13 macros + 4
schemas that use MarkdownAI directive syntax. 18 of 29 documents failed to parse
with MarkdownAI 1.0.0 because the parser was stricter than the v2 flow design
required. The patterns in question are deliberate and widely used across
mdd2's flow library — fixing mdd2 to avoid them was not the right call.

### Changes

**Parser: accept `@on complete -> halt` as a transition action.** Used at the
top of a `@phase` block (or inside conditional bodies) to terminate the flow
without transitioning to another phase. The engine treats transition nodes as
no-ops; the runtime walks them in evaluation context. Files: `parser-blocks.ts`,
`types.ts` (added `{ type: 'halt' }` to `TransitionAction`).

**Parser: accept `@on complete -> next` as a transition action.** Used inside
`@define` blocks to return-to-caller, and inside `@phase` blocks for explicit
"advance to next phase" semantics. Files: same as above (added `{ type: 'next' }`
to `TransitionAction`).

**Parser: allow `@on` inside `@define` blocks.** Previously `@on` was only valid
in `@phase` blocks. Macros that conditionally short-circuit (e.g.,
mdd2's `invocation-logging` macro returning early when telemetry is off) need
the same transition affordance. Files: `parser.ts` (`parseDefineBlock` walks
transitions like `parsePhaseBlock`), `types.ts` (`DefineNode.transitions: TransitionNode[]`).

**Parser: allow `@on` inside conditional bodies within `@phase`/`@define`.** The
previous parser rejected `@on` everywhere except the immediate body of a
`@phase`. mdd2 flows pattern `@if ... @on complete -> halt @endif` for
conditional bailout. `parser-state.ts` adds a `blockStack: BlockContext[]` so
`parseNextNode` can permit `@on` when inside a phase/define block (the nested
`@on` becomes a regular body node — engine still treats it as a no-op).

**Parser: `@event` no longer requires a `data=` argument.** Signal events
(progress ticks, heartbeats, marker beacons) often have no payload. The check
in `directives/event.ts` was removed; `data` defaults to `''`. Existing payload
events are unaffected.

**Parser: `@constraint severity` accepts `warning` literal and templated
values.** mdd2's schemas use a `warning` severity tier between `medium` and
`low`. The constraint parser also needs to accept templated severity values
like `{{ this.severity }}` (resolved by the engine at evaluation time, not at
parse). `directives/constraint.ts` adds `warning` to the literal set and skips
the static check for any value containing `{{ }}`. `ConstraintNode.severity`
type widened to `'critical' | 'high' | 'medium' | 'low' | 'warning' | string`.

### Test coverage

Added tests in:
- `packages/parser/src/__tests__/parser.test.ts` — halt/next transitions, @on
  inside @define, conditional @on inside @if
- `packages/parser/src/__tests__/event.test.ts` — empty-payload events
- `packages/parser/src/__tests__/constraint.test.ts` — warning + templated
  severity

Full markdownai workspace test suite: 1169 tests, all passing (181 parser,
681 engine, 45 renderer, 52 mcp, 126 core, 84 vscode).

### Backwards compatibility

All changes are additive. No existing markdownai consumer is affected:
- Top-level `@on` still throws `ParseError`.
- The only `@event` test that previously expected a throw for missing `data=`
  has been updated to expect the new default behavior.
- `@constraint` with unknown literal severities still throws.

### Engine impact

None. The engine already treats `transition` nodes as no-op markers (`case
'transition': return ''` in engine.ts). The new TransitionAction variants
(`halt`, `next`) carry semantic intent for runtime evaluators but require no
engine code changes to ship.

### Pin in mdd2

mdd2 should pin `@markdownai/core` (and `@markdownai/mcp` for the MCP-side
consumers) to `^1.1.0` once this branch is merged and published. Until then,
mdd2 dev uses `npm link` against this branch.
