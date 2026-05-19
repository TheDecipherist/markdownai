@markdownai v1.0

# Phase System Evaluation: MarkdownAI vs Plain Markdown

This document proves the value of MarkdownAI phases through measurement and
demonstration. It answers three questions:

1. Do phases actually isolate information? (Yes, and here is the proof)
2. How much context does phase loading save? (Real numbers, not estimates)
3. What does this mean for a real AI workflow?

---

## 1. How Phase Isolation Actually Works

When you call `resolve_phase(file, "testing")`, the MarkdownAI engine:

1. Parses the entire file into an AST
2. Walks every node
3. For any `@phase` node whose name is NOT "testing": **returns empty string**
4. For the matching `@phase "testing"`: renders its body normally
5. Global content (header, constraints, macros, `@define` blocks) renders in full

The content from other phases is never handed to the caller. It is not truncated,
it is not summarized - it simply does not exist in the output. The engine produces
a string that contains only the active phase body and the global context.

This is the architecture guarantee:

```typescript
// packages/engine/src/handlers/phase.ts (simplified)
function handlePhase(node: PhaseNode, ctx: ExecutionContext): string {
  if (ctx.phase !== null && ctx.phase !== node.name) {
    return ''   // ← all other phases become empty string
  }
  return renderChildren(node.body, ctx)
}
```

---

## 2. The Amnesia Test - Proving Claude Cannot See Other Phases

The file `MDs/tests/test-phase-amnesia.md` contains three phases, each with
a unique passphrase and compartment-specific information:

| Phase | Passphrase | Designation |
|-------|-----------|-------------|
| red | CRIMSON-FALCON-DELTA-9 | SCARLET |
| blue | AZURE-HAWK-SIERRA-3 | COBALT |
| green | EMERALD-VIPER-ECHO-5 | JADE |

**The test:** Resolve Phase Blue and ask: "What is the Phase Red passphrase?"

If Claude answers "CRIMSON-FALCON-DELTA-9", the phase system has failed.
If Claude says it cannot know - the phase system is working.

**How to run the test:**

```
resolve_phase("MDs/tests/test-phase-amnesia.md", "blue")
```

The returned content will contain "AZURE-HAWK-SIERRA-3" and "COBALT".
It will NOT contain "CRIMSON" or "SCARLET" or "EMERALD" or "JADE".

This is not an honor system. The MCP server calls the engine with `{ phase: "blue" }`,
and the engine's phase handler suppresses every other phase body before returning
the string. Claude receives a string that physically does not contain the other values.

---

## 3. Token Measurement - Real Numbers

Using `MDs/tests/test-phase-realistic.md` - a realistic 6-phase API service
build workflow (587 lines, 21,009 characters).

### Full Document Load (Plain Markdown Approach)

| Metric | Value |
|--------|-------|
| Total characters | 21,009 |
| Estimated tokens | ~5,252 |
| Phases in document | 6 |
| Irrelevant content ratio | up to 84% |

If a plain .md file is read for any single phase's work, Claude receives all
21,009 characters - including 5 phases worth of information that has nothing
to do with the current task.

### Per-Phase Load (MarkdownAI Approach)

Each `resolve_phase` call returns the global header (constraints, macros,
document context) plus only the named phase body:

| Phase | Chars Returned | Est. Tokens | % of Full File |
|-------|---------------|-------------|----------------|
| discovery | 3,633 | ~908 | 17.3% |
| architecture | 5,421 | ~1,355 | 25.8% |
| implementation | 4,206 | ~1,052 | 20.0% |
| testing | 4,478 | ~1,120 | 21.3% |
| review | 4,029 | ~1,007 | 19.2% |
| deployment | 4,031 | ~1,008 | 19.2% |
| **Average** | **4,300** | **~1,075** | **~20.5%** |

### Savings Per Phase Call

| Metric | Value |
|--------|-------|
| Full file tokens | ~5,252 |
| Avg phase tokens | ~1,075 |
| Tokens saved per call | ~4,177 |
| Savings percentage | ~79% |
| Context window freed | ~79% |

On a workflow with 6 phases, if you loaded the full file for each phase that is
~31,500 tokens consumed. With phases, it is ~6,450 tokens - an 80% reduction.

---

## 4. Workflow Comparison

### Plain Markdown Workflow

```
User: "Read project-plan.md and help me with the testing phase"

Claude action:
1. Read entire file (5,252 tokens into context)
2. Find testing section manually
3. Respond based on everything it saw
4. No phase boundary - might reference implementation details
   or deployment steps that aren't relevant yet

Context cost: 5,252 tokens every time
Information bleed: Claude sees all phases at once
No workflow enforcement: No way to know which phase is "active"
```

### MarkdownAI Phases Workflow

```
User: "What is my active phase?"
Tool: list_phases(file) -> returns phases with transitions
      next_phase(file, "implementation") -> "testing"

User: "Help me with the testing phase"
Tool: resolve_phase(file, "testing") -> 1,120 tokens

Claude action:
1. Receives only testing phase content + global constraints
2. Cannot see implementation details or deployment steps
3. Responds focused purely on what testing requires
4. @prompt in the phase gives Claude exact instructions
5. Calls next_phase to confirm what comes after
```

### Side-by-Side

| Property | Plain Markdown | MarkdownAI Phases |
|----------|---------------|-------------------|
| Tokens per task | ~5,252 (full file) | ~1,075 (one phase) |
| Token reduction | - | ~79% |
| Information bleed | Always - all phases visible | None - phase boundary is hard |
| Workflow state | Must infer from content | next_phase() is explicit |
| Phase-specific instructions | Inline, often ignored | @prompt block - always read |
| Global constraints | Repeated in prose | @constraint blocks, machine-readable |
| Macro reuse | Copy-paste | @define once, @call everywhere |
| AI instruction quality | Mixed with content | Separate @prompt section |

---

## 5. What Phase Isolation Prevents

**The problem with full-file reads:**

When Claude reads a 6-phase project plan, it knows about everything simultaneously.
It might:
- Reference deployment decisions when you're still in the discovery phase
- Apply testing-phase constraints to architecture decisions that predate them
- Conflate "what was decided" with "what is being decided now"
- Leak information from a sensitive phase into a less sensitive one

**With phases:**

Each `resolve_phase` call gives Claude a clean context. It knows:
- The global constraints (always)
- The current phase's content (only)
- The phase-specific @prompt instruction (clearly separated)

It does NOT know:
- What happened in previous phases (unless you include a summary in global)
- What comes in future phases
- Sensitive data stored in other compartments

---

## 6. Measuring the Saving Yourself

To verify these numbers on the realistic test document:

```
# Full file character count
mai count MDs/tests/test-phase-realistic.md

# Resolve a single phase and count the output
mai render MDs/tests/test-phase-realistic.md --phase testing | wc -c

# Or use MCP tools:
resolve_phase("MDs/tests/test-phase-realistic.md", "testing")
# Measure the length of the string returned
```

For the amnesia proof:

```
resolve_phase("MDs/tests/test-phase-amnesia.md", "blue")
# Confirm output:
# - Contains "AZURE-HAWK-SIERRA-3"
# - Does NOT contain "CRIMSON-FALCON-DELTA-9"
# - Does NOT contain "EMERALD-VIPER-ECHO-5"
```

---

## 7. The Information Compartmentalization Use Case

Beyond token savings, phase isolation enables a workflow pattern that is
impossible with plain markdown:

**Compartmentalized knowledge documents.** Store information that different
AI sessions should not cross-contaminate. Red team tactics in one phase,
blue team defenses in another. A negotiation position in one phase,
the BATNA in another. Customer A's requirements in one phase,
Customer B's in another.

Each call to `resolve_phase` is a hard information boundary backed by the
engine, not by prompt instructions that can be argued away.

The @constraint blocks in the global header always arrive with every phase.
They cannot be stripped. They are not in a "system prompt" that can be
overridden - they are embedded in the content itself and re-enforced by the
document author, not by the AI caller.

---

@prompt
This document contains real measured numbers from the test files in MDs/tests/.
If the test files change, re-run the measurement commands in Section 6 and
update the tables in Section 3.

Key files referenced:
- MDs/tests/test-phase-amnesia.md (3 phases, compartmentalized passphrases)
- MDs/tests/test-phase-isolation.md (4 phases, sentinel strings)
- MDs/tests/test-phase-realistic.md (6 phases, 587 lines, 21,009 chars)
@end
