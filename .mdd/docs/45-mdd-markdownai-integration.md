---
id: 45-mdd-markdownai-integration
title: MDD + MarkdownAI Integration — Discovery & Improvement Map
edition: Both
depends_on: []
source_files: []
routes: []
models: []
test_files: []
data_flow: greenfield
last_synced: 2026-05-16
status: draft
phase: discovery
mdd_version: 1.6.5
tags: [mdd, markdownai, integration, discovery, workflow, live-docs, mcp, phases]
path: Integration/MDD
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 45 — MDD + MarkdownAI Integration: Discovery & Improvement Map

## Purpose

MarkdownAI was built so MDD could use it. This document catalogs exactly how — every place where a live markdown document with a `@markdownai` header, a phase-aware workflow, or an MCP-backed query can make MDD more accurate, self-checking, and powerful. This is the north star: MDD's own documentation artifacts should embody MarkdownAI's tagline, "documentation that cannot lie."

No implementation is decided here. This is the full discovery map from which we choose what to build next.

---

## Architecture

MDD is a collection of seven markdown instruction files (~4,050 lines total) that Claude loads lazily per invocation. Each run produces artifacts in `.mdd/`: feature docs, audit reports, ops runbooks, a session startup context, and a connections map. All artifacts are currently static markdown — they are accurate when written and drift silently thereafter.

MarkdownAI turns any `.md` file into a live document simply by adding a `@markdownai` header. It adds: live data queries (`@read`, `@query`, `@db`, `@http`, `@list`), module composition (`@define`, `@include`, `@import`), conditional rendering (`@if`), phase-aware workflows (`@phase`/`@on complete`), session and disk caching, content masking, and an MCP server (`mai-serve`) that exposes live execution context to Claude.

The integration opportunity exists in both directions:

1. **MDD uses MarkdownAI** — mode files, session context, and artifacts become live documents with `@markdownai` headers
2. **MarkdownAI uses MDD** — the MDD workflow gets new capabilities specifically for building MarkdownAI-powered projects

---

## Discovery Findings

### Finding 1 — `.startup.md` Is Always Stale

**Current state:** `.startup.md` is a static markdown file rebuilt by Claude whenever a MDD command runs (status, scan, audit, every build). Between rebuilds it drifts: feature counts change, audit summaries age, the branch field becomes wrong.

**MarkdownAI improvement:** Add a `@markdownai` header to `.mdd/.startup.md`. The file queries its own data on render:

```markdown
@markdownai
@query git branch --show-current
@query git log --oneline -5
@count .mdd/docs/ "status: complete"
@count .mdd/docs/ "status: in_progress"
@count .mdd/docs/ "status: draft"
@list .mdd/docs/*.md format={numbered}
@read .mdd/audits/report-*.md @sort=mtime @limit=1
@date format={YYYY-MM-DD HH:mm}
```

A pre-session hook runs `mai render .mdd/.startup.md` before Claude is invoked (writing output to a rendered copy). The startup context Claude reads is always accurate — never manually maintained.

**Impact:** Eliminates the entire class of "startup context is stale" problems. Claude enters every session knowing exactly what's complete, what's in progress, and what the last audit found — without anyone having run `/mdd status` recently.

**Effort estimate:** Small. Primarily a template authoring task.

---

### Finding 2 — `connections.md` Must Be Rebuilt After Every Doc Change

**Current state:** `.mdd/connections.md` is a generated file (path tree + Mermaid dependency graph + source file overlap). MDD rebuilds it after every doc create/modify/archive operation. It must be committed to git. It can drift if someone edits a doc manually.

**MarkdownAI improvement:** Add a `@markdownai` header to `.mdd/connections.md`. Every render reads the current doc state:

```markdown
@markdownai
@list .mdd/docs/*.md format={json}
@graph depends_on from={.mdd/docs/*.md} style={mermaid}
@tree .mdd/docs/ depth=2
```

`mai render .mdd/connections.md` replaces the entire Claude-driven rebuild. Add it to the pre-session hook alongside `.startup.md`. Add `mai validate .mdd/connections.md` to CI to catch broken `depends_on` references automatically.

**Impact:** Connections map is never stale, never needs a Claude rebuild, and broken dependency refs surface in CI rather than silently accumulating.

**Effort estimate:** Medium. Requires `@graph` directive to support `depends_on` frontmatter extraction. The `@list` + `@read` pipeline exists; the graph rendering needs a template.

---

### Finding 3 — Feature Docs Can Lie About Their Own Status

**Current state:** A feature doc can say `status: complete` while its `source_files` list contains paths that don't exist. This is caught by audit, but only when someone runs `/mdd audit`. Between audits, the doc is authoritative and wrong.

**MarkdownAI improvement:** Add a `@markdownai` header to feature docs and embed a live health section:

```markdown
@markdownai
@if @list {{ source_file }} returns empty
  ⚠️  Source file missing: {{ source_file }}
@endif
@if status == "complete"
  @query pnpm typecheck 2>&1 | tail -3
@endif
```

Running `mai render .mdd/docs/05-lang-header.md` immediately shows whether source files exist and whether typecheck passes — without running a full audit.

Additionally, a MDD health aggregator (`mai render .mdd/health.md`) could report across all docs at once.

**Impact:** The "status: complete with missing files" bug that audit Phase 7c currently catches becomes visible on render. "Documentation that cannot lie" applied to MDD's own docs.

**Effort estimate:** Medium. Requires feature doc template update + a health aggregator doc.

---

### Finding 4 — MDD Mode Files Have Repeated Patterns With No Abstraction

**Current state:** The 7 mode files share significant repeated patterns: the branch guard logic (appears in mdd.md and is referenced by all modes), the bootstrap check (runs silently at the start of every mode), the Green Gate loop, the commit/merge flow. Each is duplicated in prose across files.

**MarkdownAI improvement:** Add `@markdownai` headers to mode files and extract shared patterns as `@define` macros:

```markdown
@markdownai
@define branch-guard
  @query git branch --show-current
  @if {{ result }} == "main" or {{ result }} == "master"
    ⚠️  MDD Branch Guard — working directly on {{ result }}
  @endif
@end

@define bootstrap-check
  @list .mdd/ returns missing → create structure
@end
```

Mode files `@import` the shared library: `@import .mdd/lib/mdd-shared.md`. Changes to the branch guard propagate everywhere automatically.

**Why not do this today:** MDD mode files are instruction prompts read by Claude, not executed documents. Converting them to MarkdownAI means `mai render` would need to be involved in every MDD invocation. This is feasible — make it an MDD installation option.

**Impact:** Eliminates duplicated prose, makes the branch guard a single source of truth, and opens the door to `@if @env MDD_PROJECT_TYPE` conditional mode rendering (e.g., show DB questions only for backend projects).

**Effort estimate:** Large. Architectural change to how MDD mode files are consumed. Best approached as a separate MDD v2 initiative.

---

### Finding 5 — Ops Runbooks Are Instructions, Not Executable Documents

**Current state:** Ops runbooks (`/mdd ops`) are markdown procedures with services, regions, health checks, and credentials (env var names only). "Executing" one means Claude reads it and follows along. There's no self-checking.

**MarkdownAI improvement:** Add a `@markdownai` header to runbooks and use phase gates:

```markdown
@markdownai
@phase pre-flight
  @env DEPLOY_TOKEN required
  @http GET {{ HEALTH_ENDPOINT }}/health expected=200
  @query docker image ls {{ IMAGE_NAME }} | head -2
@on complete
  Deploy pre-flight passed. Proceeding to deploy phase.
@end

@phase deploy
  @if @env PRODUCTION
    @query kubectl set image deployment/{{ APP_NAME }} {{ IMAGE_NAME }}:{{ TAG }}
  @else
    @query docker-compose up -d {{ APP_NAME }}
  @endif
@on complete
  Deployment complete. Running post-flight checks.
@end

@phase post-flight
  @http GET {{ HEALTH_ENDPOINT }}/health expected=200 retries=5 delay=10s
  @query kubectl get pods -l app={{ APP_NAME }}
@end
```

Running `mai render ops/deploy-production.md` executes the runbook. Pre-flight failures stop before any deployment happens. Health check failures are shown with actual HTTP responses, not just "check if it's up."

**Impact:** Runbooks go from "instructions a human follows" to "executable procedures that self-validate." The `@env required` directive prevents running a deploy without required credentials set.

**Effort estimate:** Medium per runbook. Template creation is the main work; conversion is per-project.

---

### Finding 6 — MCP Server + Phase Navigation Maps Directly to MDD Phases

**Current state:** MDD phases (0 through 7d) are prose sections in markdown. Claude advances through them by reading and following text. Phase state is ephemeral — context compaction loses it.

**MarkdownAI `mai-serve` tools available:**
- `list_phases` — enumerate all `@phase` blocks in a document
- `resolve_phase` — check if a named phase's preconditions are met
- `next_phase` — advance to the next phase
- `execute_directive` — run any directive and return the result to Claude
- `get_constraints` — expose CLAUDE.md rules to Claude as structured context

**Integration opportunity:**

**A.** Add `@markdownai` headers to MDD mode files with each workflow phase as a `@phase` block. Run `mai-serve` alongside Claude Code during MDD sessions. Claude calls `list_phases` to know what phase it's on, `resolve_phase` to check preconditions (did the Red Gate actually pass?), and `next_phase` to advance.

**B.** Phase state persists in `mai-serve` across context compaction. When the conversation resets, Claude calls `list_phases` to re-orient — it knows "Phase 4b (Red Gate)" completed and "Phase 5 (Build Plan)" is next, without re-reading the whole conversation.

**C.** `execute_directive @query pnpm test:unit` via MCP returns structured results Claude can act on programmatically, rather than reading raw terminal output.

**D.** `get_constraints` makes CLAUDE.md rules available as structured data during implementation — Claude can check "is there a rule against this pattern?" without re-reading CLAUDE.md.

**Impact:** Phase tracking survives context compaction. Pre-conditions are verifiable, not assumed. This is the highest-leverage integration point for complex multi-phase MDD builds.

**Effort estimate:** Large. Requires MDD mode file conversion + `mai-serve` protocol extension for phase-state persistence. Best as an MDD v2 milestone.

---

### Finding 7 — Audit Reports Go Stale as Code Changes

**Current state:** Audit reports are static markdown. A finding like "checkFilePath is not called in executeInclude" is accurate at audit time. If the fix is applied, the finding remains in the report — accurate to the past, wrong about the present.

**MarkdownAI improvement:** Add a `@markdownai` header to audit reports and embed `@include` references in each finding:

```markdown
@markdownai

### P1 — checkFilePath not called in executeInclude

**Status check (live):**
@include packages/engine/src/executeInclude.ts lines=45-70

**Expected:** `checkFilePath(resolvedPath)` called before file read
**Finding:** Call was absent at time of audit (2026-05-16)
```

When the audit doc is rendered after a fix, the embedded code shows the current state. A reviewer can see in one `mai render` whether the finding is still relevant.

**Impact:** Audit docs become living documents. "Finding still open" vs "finding resolved" is visible on render without needing a new audit run.

**Effort estimate:** Small. Requires adding `@include` references to audit report templates. `@include` with line ranges already exists.

---

### Finding 8 — MDD Needs First-Class Support for Live Markdown Documents

**Current state:** MDD has no concept of MarkdownAI documents as build artifacts. Feature docs track `source_files` (TypeScript) and `test_files` (test specs) but have no field for live markdown documents produced by a feature.

**What's missing in MDD to develop MarkdownAI-powered projects:**

**A. New feature doc fields:**
```yaml
live_documents:
  - .mdd/.startup.md
  - .mdd/connections.md
directives_used: [read, list, query, graph, phase, define]
```
These tell MDD audit to validate these documents with `mai validate` as first-class outputs.

**B. A `/mdd validate-live` mode:**
- Runs `mai validate` on all live documents in the project (those with `@markdownai` headers)
- Reports: broken `@include` paths, unresolved `@env` variables, syntax errors
- Runs as part of `/mdd audit` for MarkdownAI projects
- Separate from code audit — focused on "do these live documents execute cleanly?"

**C. Feature doc template extension for MarkdownAI directive features:**
- Phase 3 doc template extended with `directives_used` and `live_documents` fields
- Phase 7b integration verification includes `mai validate` for live documents
- Audit Phase 7c checks that all `live_documents` exist and `mai validate` passes

**D. Skeleton generation for live documents (Phase 4 extension):**
- For features that produce live markdown documents, Phase 4 generates a skeleton document alongside test skeletons
- Skeleton has the `@markdownai` header, empty `@phase` blocks, placeholder directives
- Red Gate includes `mai validate skeleton.md` — confirms it parses before implementation

**Impact:** MarkdownAI development gets the same "document-first, test-first" discipline that MDD provides for TypeScript. Currently, live documents are built ad-hoc without MDD structure.

**Effort estimate:** Medium. New field additions to templates are small. The `/mdd validate-live` mode is a new mode file.

---

### Finding 9 — The `.mdd/` Bootstrap Creates Dead Static Templates

**Current state:** When MDD initializes a new project, it creates `.startup.md` with a static placeholder template. Users must run `/mdd status` to populate it. Until then, it contains "(unknown)" fields.

**MarkdownAI improvement:** The bootstrap creates `.startup.md` with a `@markdownai` header and live queries from day one:

```markdown
@markdownai
@date format={YYYY-MM-DD HH:mm}
@query git branch --show-current
@query git remote get-url origin 2>/dev/null || echo "(no remote)"

## Project Snapshot
Generated: {{ date }} | Branch: {{ query:git-branch }}
Remote: {{ query:git-remote }}

## Stack
@read package.json format={json} path={$.name}
@query node --version

## Features Documented
@count .mdd/docs/ "status: complete" → {{ result }} complete
@count .mdd/docs/ "status: in_progress" → {{ result }} in progress
@count .mdd/docs/ "status: draft" → {{ result }} draft
```

On first MDD session, `mai render .mdd/.startup.md` already shows real data — no manual `/mdd status` run needed.

**Impact:** New project setup produces accurate context immediately. The (unknown) placeholder problem disappears.

**Effort estimate:** Small. Template authoring only.

---

### Finding 10 — The Philosophical Closure: MDD Docs Should Not Lie

The central tension: MDD enforces "document first" — write the doc before the code, keep the doc as the source of truth. But MDD's own artifacts (feature docs, startup context, connections map, audit reports) are static markdown. They can and do drift.

MarkdownAI's tagline is "documentation that cannot lie." Applying MarkdownAI to MDD's own artifacts closes the loop:

- `.startup.md` with `@markdownai` → session context that reflects current git/doc state on render
- `connections.md` with `@markdownai` → dependency graph that cannot reference a doc that doesn't exist
- Feature docs with `@include source_file` → implementation that shows current code, not the code at doc-writing time
- Audit reports with `@include` → findings that show current code, making resolution visible

**This is the north star for the integration:** MDD becomes a workflow tool whose documentation infrastructure embodies the property it enforces in the projects it manages.

---

## Dependency Map

This discovery is cross-cutting and depends on the full MarkdownAI stack (Waves 1–4). Specific integration points by finding:

| Finding | Key directives/features | Wave |
|---------|------------------------|------|
| 1 — Live startup.md | @query, @count, @list, @read, @date | 2–3 |
| 2 — Live connections.md | @list, @graph, @tree | 2 (graph TBD) |
| 3 — Feature doc health | @if, @list, @query | 2 |
| 4 — Mode file macros | @define, @import, @if | 2 |
| 5 — Executable runbooks | @phase, @env, @http, @if | 2–3 |
| 6 — MCP phase navigation | mai-serve, list_phases, next_phase | 4 (MCP) |
| 7 — Live audit reports | @include with line ranges | 2 |
| 8 — /mdd validate-live | new MDD mode file | MDD project |
| 9 — Bootstrap template | @query, @count, @date | 2 |

---

## Prioritization Framework

Group findings by effort and impact for decision-making:

**Quick wins (small effort, high impact):**
- Finding 1: Live `.startup.md` — eliminates the most common source of stale context
- Finding 7: Audit reports with `@include` — immediate value with existing directives
- Finding 9: Bootstrap template with `@markdownai` — correct from day one

**Medium investment:**
- Finding 2: Live `connections.md` — needs `@graph` on frontmatter data; directives exist
- Finding 3: Feature doc health checks — needs template authoring + `@if`/`@list`
- Finding 5: Executable ops runbooks — high value for production workflows
- Finding 8: MDD first-class live document support — foundational for future MarkdownAI development via MDD

**Larger initiative:**
- Finding 4: Mode files with `@markdownai` — architectural change; best as MDD v2
- Finding 6: MCP phase navigation — requires `mai-serve` extension + mode file conversion

---

## Recommended Starting Point

If selecting one finding to implement first, **Finding 1** (live `.startup.md`) is the most valuable with the least risk:

1. It uses directives already fully implemented (Waves 1–2)
2. It solves an immediate and visible problem (stale session context)
3. It produces a tangible artifact that MDD users encounter every session
4. It is a working demonstration of "documentation that cannot lie" applied to MDD itself — the clearest proof of concept for the integration

From there, **Finding 8** (MDD first-class live document support) enables building all subsequent findings through the MDD workflow itself — a natural bootstrap.

---

## Security

No new attack surface. This discovery document covers tooling and workflow improvements. Individual implementation findings that touch `@query` (shell execution) or `@http` fall under the existing security model: document-root confinement, platform detection for shell commands, cloud metadata blocking, and content masking before caching — all already enforced by the MarkdownAI engine.

Live ops runbook documents (Finding 5) must follow the existing `@env` pattern for credentials — env var names only, never hardcoded values.

---

## Known Issues

None — discovery document, no implementation.
