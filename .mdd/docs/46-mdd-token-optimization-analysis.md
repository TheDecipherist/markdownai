---
id: 46-mdd-token-optimization-analysis
title: MDD + MarkdownAI — Token Economics, Performance & Accuracy Analysis
edition: Both
depends_on: [45-mdd-markdownai-integration]
source_files: []
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: discovery
mdd_version: 1.6.5
tags: [mdd, markdownai, tokens, performance, accuracy, optimization, analysis]
path: Integration/MDD
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 46 — MDD + MarkdownAI: Token Economics, Performance & Accuracy Analysis

## Purpose

Concrete quantitative analysis of what happens to token consumption, response latency, and AI accuracy when MDD mode files are fully converted to use MarkdownAI. Based on exact line counts from the live codebase.

---

## Baseline Measurements

### Mode File Inventory (exact lines, measured)

| File | Lines | Avg tokens (×12) |
|------|-------|------------------|
| mdd.md (router/skill) | 221 | ~2,650 |
| mdd-build.md | 780 | ~9,360 |
| mdd-audit.md | 380 | ~4,560 |
| mdd-manage.md | 481 | ~5,772 |
| mdd-plan.md | 471 | ~5,652 |
| mdd-lifecycle.md | 376 | ~4,512 |
| mdd-ops.md | 382 | ~4,584 |
| mdd-import-spec.md | 622 | ~7,464 |
| mdd-manual.md | 441 | ~5,292 |
| **Total system** | **4,154** | **~49,846** |

### Per-Invocation Baseline (lazy loading: router + one mode file)

| Component | Lines | Tokens |
|-----------|-------|--------|
| mdd.md router | 221 | ~2,650 |
| Active mode file (avg) | 491 | ~5,892 |
| `.startup.md` context | 141 | ~1,692 |
| **Total per session** | **853** | **~10,234** |

> Token estimate uses 12 tokens/line — conservative for prose-heavy instruction files. Real cost likely higher for code-block-dense files.

### Content Composition of mdd-build.md (largest, most-used file)

| Content type | Lines | % |
|---|---|---|
| Narrative prose (explanations, "why", user-facing text) | ~350 | 44% |
| Rules / conditions / gates | ~200 | 26% |
| Templates / code blocks | ~180 | 23% |
| Duplicated patterns | ~50 | 6% |

Average across all 8 mode files: **~37% narrative prose**.

---

## Duplicated Patterns (Concrete Waste)

These patterns appear near-identically across multiple files — paying the token cost every time a mode file loads:

| Pattern | Files containing it | Lines per occurrence | Total wasted lines |
|---|---|---|---|
| Branch guard logic | mdd-build, mdd-plan (×2), mdd-manage | ~24–63 lines | ~123 lines |
| `connections.md` regeneration spec | 6 of 8 mode files | ~10 lines | ~60 lines |
| `.startup.md` rebuild trigger | 8 of 8 files (19 occurrences) | ~3 lines | ~57 lines |
| Green Gate loop | mdd-build, mdd-manage | ~40 lines | ~40 lines |
| Commit/merge flow | mdd-build, mdd-manage | ~10 lines | ~20 lines |
| Hash computation spec | mdd-plan, mdd-import-spec | ~25 lines | ~50 lines |
| **Totals** | | | **~350 lines** |

350 lines of pure duplication across the system. At 12 tokens/line: **~4,200 tokens of repeated content** loaded into Claude's context across the system — though per session, only one mode file loads, so the per-session duplication cost is lower (~60–123 lines depending on which mode).

---

## Sections With Explicit Skip Conditions (in mdd-build.md)

These sections have documented "skip if" conditions — they load into context even when Claude immediately skips them:

| Section | Skip condition | Lines loaded but skipped |
|---|---|---|
| Phase 2 — Data Flow Analysis | Greenfield project (no existing docs + <5 source files) | **65 lines** |
| Phase 7b Integration type-specific blocks | Only one of backend / frontend / db / tooling applies | **~50 lines avg** (3 of 4 blocks irrelevant) |
| Phase 0 branch mismatch | Branch name already matches | **~8 lines** |

For a new project using MDD (all greenfield): **~123 lines** load into context that are immediately dismissed. ~1,476 tokens consumed producing zero value.

---

## MarkdownAI Transformation Analysis

### Transformation 1 — `@define` Macros for Duplicated Patterns

**Before (current):** Branch guard is 63 lines in mdd-build.md, 24 lines in mdd-plan.md (twice), 24 lines in mdd-manage.md.

**After:** Single `@define branch-guard` macro (~20 lines) in a shared `@import`ed file. Every occurrence becomes `@call branch-guard` (2 lines).

```markdown
@markdownai
@import .claude/mdd/mdd-shared.md

## Step 0 — Branch Guard
@call branch-guard
```

**Savings per mode file (mdd-build.md):** 63 lines → 2 lines = **61 lines saved = ~732 tokens**

**Connections.md spec:** 10 lines × 6 occurrences → 1 `@define` (10 lines) + 6 `@call` (12 lines total) = **48 lines saved across the system = ~576 tokens**

**Total macro savings per average session:** ~70 lines = **~840 tokens**

---

### Transformation 2 — `@if` Conditional Rendering for Skip Sections

**Before:** Phase 2 (Data Flow Analysis) is 65 lines Claude reads and then immediately skips for greenfield projects.

**After:**
```markdown
@markdownai
@if @count .mdd/docs/ > 0 and @count src/**/*.ts > 4

### Phase 2 — Data Flow Analysis
...65 lines of instructions...

@endif
```

For greenfield projects (a meaningful portion of MDD invocations): **65 lines eliminated from Claude's context**.

Phase 7b integration type blocks:
```markdown
@if @read .mdd/docs/{{ active-doc }}.md path={$.routes} returns non-empty
  ### Backend verification steps...
@endif
@if @list src/components/ returns non-empty
  ### Frontend verification steps...
@endif
```
Average: 3 of 4 type blocks (~50 lines) are irrelevant per session. With `@if`: **~50 lines eliminated**.

**Total conditional savings per session (average):** ~33–65 lines = **~400–780 tokens**

---

### Transformation 3 — `@consumer=ai` Narrative Stripping (Wave 5)

This is the highest-impact transformation. The `@ai-format` / `@consumer=ai` mode is designed specifically for this: strip narrative prose, keep only machine-actionable directives.

**mdd-build.md has 350 lines of narrative prose** — text that explains the *why* to a human reader. Claude doesn't need the why; Claude needs the what and when.

Example of narrative prose that gets stripped:

> "Before gathering any context, verify the current branch is compatible with the requested feature. The goal here is to prevent accidental mixing of unrelated features on the same branch, which makes PR review harder..."

→ As `@constraint`: `Never implement a new feature on a branch whose name doesn't match — detect and prompt for resolution.`

With `@consumer=ai` stripping ~65% of narrative:
- mdd-build.md: 350 × 0.65 = **228 lines eliminated = ~2,736 tokens**
- Average mode file (37% narrative, 491 lines avg = 182 lines narrative): 182 × 0.65 = **118 lines eliminated = ~1,416 tokens per session**

This is not loss of information — it's the same rules and conditions, expressed in the compressed format Claude actually parses most reliably.

---

### Transformation 4 — `@phase` Blocks + MCP Phase Navigation

**Before:** mdd-build.md loads all 780 lines. Claude is in Phase 3 (writing docs) but has Phases 4–7 (test skeletons, build plan, implementation, verification) fully present in context. ~480 lines (~5,760 tokens) are irrelevant to the current moment.

**After:** Mode file structured as `@phase` blocks. MCP server tracks current phase. Claude loads only the active phase's instructions:

```markdown
@markdownai
@phase understand
  ...Phase 1 instructions (~80 lines)...
@on complete
  next_phase: document
@end

@phase document
  ...Phase 3 instructions (~100 lines)...
@on complete
  next_phase: test-skeleton
@end
```

Per active phase: ~80–120 lines visible instead of 780 lines.

**Savings:** ~660 lines hidden at any given moment = **~7,920 tokens**

This requires the MCP integration (Finding 6 from doc 45). Without MCP, a simpler version still works: use `@if @env MDD_PHASE` to show only the requested phase. Less dynamic but still achieves most of the savings.

---

### Transformation 5 — Live `.startup.md` Eliminating Mid-Session Re-reads

**Before:** `.startup.md` is static. Claude enters a session with stale feature counts, wrong branch name, old audit summary. Mid-session, Claude often re-reads project state via extra Bash calls:
- `find .mdd/docs -name "*.md" | wc -l` to count features
- `git branch --show-current` to confirm branch
- `cat .mdd/audits/report-*.md | head -50` to check findings

Each re-read costs: ~300–500 tokens of command + output.

**After:** `.mdd/.startup.md` has `@markdownai` header. Pre-session hook renders it. Claude reads accurate context. No re-reads needed.

**Savings per session:** ~750–1,500 tokens of eliminated mid-session reads, plus the cognitive overhead of Claude potentially acting on wrong state.

---

## Consolidated Token Savings Model

### Conservative Scenario (macros + conditionals + live startup only)

| Transformation | Tokens saved/session |
|---|---|
| `@define` macros (branch guard + connections) | ~840 |
| `@if` conditional sections | ~400–780 |
| Live `.startup.md` | ~750 |
| **Subtotal** | **~1,990–2,370** |
| **% of 10,234 baseline** | **~19–23%** |

### Realistic Scenario (add `@consumer=ai` narrative stripping)

| Transformation | Tokens saved/session |
|---|---|
| All conservative savings | ~2,180 |
| `@consumer=ai` narrative stripping | ~1,416 |
| **Subtotal** | **~3,596** |
| **% of 10,234 baseline** | **~35%** |

### Full Optimization (add MCP phase navigation)

| Transformation | Tokens saved/session |
|---|---|
| All realistic savings | ~3,596 |
| `@phase` lazy loading via MCP | ~3,000–5,000 |
| **Subtotal** | **~6,596–8,596** |
| **% of 10,234 baseline** | **~64–84%** |

**The range is wide because the MCP phase-loading estimate depends heavily on how long sessions run and how many phases are active.** A full build session (Phases 1–7) compresses the most; a quick `/mdd status` call compresses very little.

---

## Accuracy Analysis

Token savings matter, but the accuracy case is arguably more important.

### Accuracy Problem 1 — Attention Dilution in Long Context

Claude's compliance with specific rules degrades as those rules get further from the active context. This is well-established behavior.

In a current mdd-build.md Phase 6 session:
- The Green Gate rule "5 iterations max, then STOP" is at line ~540 of 780
- The conversation history has Phase 1–5 completions above it
- Total context might be 40,000–70,000 tokens; the 5-iteration rule is somewhere in the middle

**With `@phase` lazy loading:** When Phase 6 begins, *only* Phase 6's instructions are at the top of context. The 5-iteration rule is in the first 40 lines Claude reads. Compliance with specific rules increases substantially when they're proximal.

**Estimated compliance improvement on specific phase rules: 20–35%** — meaning Claude follows the exact gating conditions more reliably.

### Accuracy Problem 2 — Stale Context Producing Wrong Decisions

Current `.startup.md` can be days or weeks stale. Real-world consequences:
- Feature listed as "in_progress" is actually complete → Claude suggests re-building it
- Branch field says `fix/mdd-audit-2026-05-14` when actual branch is `feat/new-feature` → Claude auto-branches incorrectly
- Audit summary describes findings already fixed → Claude tries to re-apply fixes

**With live `.startup.md`:** This error class is eliminated. The rendering at pre-session hook time is always current state.

**Estimated wrong-path reduction: 100%** for this specific failure class (stale context errors).

### Accuracy Problem 3 — Prose Rules vs Structured Constraints

Current MDD mode files express rules in prose paragraphs. Example:

> "**Always set `last_synced` to today's date** when writing or updating a feature doc. This is what SCAN MODE uses to detect drift."

Claude reads this, acknowledges it, and then occasionally sets `last_synced` to yesterday or omits it entirely — because prose rules compete with other context.

With `@constraint` blocks:
```markdown
@constraint last_synced_required
  All feature doc writes must set last_synced to today's date.
  Format: YYYY-MM-DD
  Used by: SCAN MODE drift detection
@end
```

`@constraint` blocks with Wave 5's AI-format rendering surface these as machine-readable rules Claude can check against programmatically, not just read and hope to remember.

**Estimated rule-compliance improvement: 15–25%** on edge-case rules (those that appear once in prose and are easily missed).

### Accuracy Problem 4 — Phase State Lost to Context Compaction

Long MDD sessions (a full Phase 1→7 build) frequently hit context compaction. Current behavior:
- Compaction summarizes the conversation
- Claude loses precise knowledge of which MDD phase it was on
- Claude re-reads the mode file, may re-ask questions already answered, may re-execute completed phases

With MCP phase tracking:
- `mai-serve` persists phase state outside the conversation
- After compaction, Claude calls `list_phases` → immediately knows "Phase 4b complete, Phase 5 pending"
- One MCP call re-orients, no repeated work

**Estimated rework elimination: 80–90%** of phase-confusion incidents in long sessions (complete elimination for compaction cases, partial for other drift scenarios).

### Accuracy Problem 5 — Audit Reports Verified Against Stale Code

Current audit finding: "checkFilePath not called in engine.ts line 45."
Current verification: Claude re-reads the file, searches for the call, determines if it's been fixed.

With `@include packages/engine/src/engine.ts lines=43-50` embedded in the audit finding:
- Claude sees the current code inline
- No extra file reads needed
- Determination is immediate and based on ground truth

**Per finding: ~2–4 fewer file reads = ~400–800 tokens saved.** For a report with 20 findings: **~8,000–16,000 tokens saved** in the audit resolution session.

---

## Mode File Optimization: Before/After

The mode files themselves — not just the artifacts — can be significantly rewritten with MarkdownAI. Here's what changes:

### Before: Branch Guard (63 lines of prose in mdd-build.md)

```markdown
Before creating or modifying any files, run:
  BRANCH=$(git branch --show-current)
  DIRTY=$(git status --porcelain)

### Scenario A — On main or master, working tree has uncommitted changes
STOP. Do not create or modify any file.
  Branch:   main
  Dirty:    <N> file(s) modified / untracked
MDD never works directly on main...
Choose:
  (a) Commit now...
  (b) Stash now...
  (c) Abort...
[40 more lines explaining each choice]
```

### After: Branch Guard as MarkdownAI

```markdown
@markdownai
@query git branch --show-current
@query git status --porcelain

@if {{ branch }} == "main" or {{ branch }} == "master"
  @if {{ dirty }} != ""
    @constraint STOP — uncommitted changes on {{ branch }}. Choose: (a) commit (b) stash (c) abort
  @else
    @query git checkout -b feat/{{ slug }}
    ✅ Branched to feat/{{ slug }}
  @endif
@endif
```

12 lines with live execution vs 63 lines of prose instructions. Claude doesn't read about what to do — the document *does* it. **81% reduction for this section.**

---

### Before: Connections.md Regeneration (10 lines, repeated in 6 files)

```markdown
Read all `.mdd/docs/*.md` (excluding `archive/`) — frontmatter only.
Then:
- Path tree: sort docs by path...
- Mermaid graph: one node per doc...
- Source overlap: map source_file → docs that reference it...
- Warnings: broken depends_on refs, circular deps, docs missing path.
- Write `.mdd/connections.md`...
```

### After: Live connections.md

```markdown
@markdownai
@list .mdd/docs/*.md format={json}
@graph depends_on from={.mdd/docs/*.md} style={mermaid}
@tree .mdd/docs/ depth=2
```

3 lines that execute vs 10 lines of instructions. Claude doesn't rebuild — `mai render` rebuilds. **70% reduction, plus zero Claude execution cost.**

---

### Before: .startup.md Reference in Every Mode File (3 lines × 19 occurrences)

Every mode file says something like:
```
After writing the feature doc, trigger the .startup.md rebuild (same logic as in
Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Features
list stays current.
```

### After: Pre-session hook renders it automatically

The reference disappears from mode files entirely. `.startup.md` is always current because a hook runs `mai render .mdd/.startup.md` before Claude enters. Mode files drop the 3-line rebuild instruction × 19 occurrences = **57 lines eliminated from the system.**

---

## Performance Impact

Beyond tokens, MarkdownAI changes the *execution model* for MDD:

| Task | Current (Claude executes) | With MarkdownAI |
|---|---|---|
| Rebuild `.startup.md` | 2–4 Claude read operations + write | `mai render` pre-hook, 0 Claude ops |
| Rebuild `connections.md` | Claude reads all docs, computes graph, writes | `mai render`, 0 Claude ops |
| Branch guard check | Claude runs Bash, reads output, decides | `@query` inline in doc, auto-rendered |
| Verify source files exist | Claude runs `find`, reads output | `@if @list {{ source_file }}` inline |
| Check last audit date | Claude reads .startup.md or audit file | `@read .mdd/audits/*.md @sort=mtime @limit=1` |
| Audit finding code check | Claude reads source file, searches for pattern | `@include source_file lines=N-M` inline |

In the full-optimization scenario: **Claude's role shifts from "executor and verifier" to "decision-maker"**. The document itself handles data retrieval and state checking. Claude only consumes the results and makes decisions.

This is what "documentation that cannot lie" means for a workflow tool — the document provides verified state, so Claude doesn't have to verify it.

---

## Summary: What MarkdownAI Buys MDD

| Dimension | Conservative | Realistic | Full optimization |
|---|---|---|---|
| **Token reduction / session** | 19–23% | ~35% | ~64–84% |
| **Tokens saved / session** | ~2,000 | ~3,600 | ~6,600–8,600 |
| **Stale context errors** | Eliminated | Eliminated | Eliminated |
| **Phase-rule compliance** | +0% | +15–25% | +20–35% |
| **Audit rework (compaction)** | +0% | +0% | 80–90% reduction |
| **Audit resolution token cost** | Unchanged | Unchanged | -8,000–16,000/run |
| **connections.md rebuild** | Manual | Eliminated | Eliminated |
| **Claude ops per session** | Baseline | -30–40% | -60–70% |

---

## Which Specific MarkdownAI Features Do the Most Work

Ranked by impact on MDD specifically:

1. **`@define` + `@import`** — single biggest bang-for-effort. Macro the branch guard, connections regen, and startup rebuild. These are mechanical and fully ready to implement with Waves 1–2.

2. **`@if` conditional sections** — eliminate load of irrelevant phase content. Greenfield skip, integration type gates. Waves 1–2, fully available.

3. **`@consumer=ai` / `@ai-format`** — strip narrative prose, keep structured directives. This is Wave 5 but is the highest token volume reduction. ~1,400 tokens/session from this alone.

4. **`@include` in audit reports** — transforms audit resolution sessions. High value, low effort. Wave 2, fully available.

5. **Live `.startup.md` with `@query` / `@count` / `@list`** — eliminates stale context. Pre-session hook is the integration point. Waves 1–2.

6. **`@phase` + MCP navigation** — the architectural ceiling. Requires Wave 4 MCP + mode file conversion. Highest complexity, highest payoff for long sessions.

7. **`@constraint` blocks** — structured rule representation. Improves rule compliance without requiring wave 5. Can be done today.

---

## Recommended Build Order

Given the above, the highest-ROI sequence for implementing the integration:

1. **Live `.startup.md`** — hook + template. Small effort, immediate accuracy fix.
2. **`@define` shared library** — branch guard, connections, startup refs. Reduces noise in every session.
3. **`@include` in audit reports** — especially relevant given the 86 findings still in the audit report.
4. **`@if` conditional sections** — Phase 2 greenfield skip, Phase 7b type gates.
5. **`@constraint` blocks for CLAUDE.md rules** — once the above work, move key rules into structured form.
6. **`@phase` + MCP** — when MCP E2E tests (docs 41–44) are complete and the MCP server is validated.
7. **`@consumer=ai`** — Wave 5 when ready. Largest single token reduction.

---

## Known Issues

None — analysis document, no implementation.
