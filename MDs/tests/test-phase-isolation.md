@markdownai v1.0

# Phase Isolation Test

This document exists to PROVE that phase isolation works. Each phase contains
a unique sentinel string. Resolving one phase must NEVER reveal another phase's
sentinel. That is the entire point of the phase system.

@constraint[critical] Phase isolation must be absolute - resolving phase A must never expose content from phase B
@constraint[critical] Global content (macros, constraints, this intro) must appear in every phase's resolved output
@constraint[high] next_phase must follow @on complete transitions exactly
@constraint[high] The last phase must return phase=null from next_phase

@define highlight(text)
>>> {{ text }} <<<
@end

---

@phase alpha
## Phase Alpha

Sentinel: ALPHA-SENTINEL-7f3k

@call highlight(This content belongs exclusively to alpha)

Tasks:
- Alpha task 1
- Alpha task 2

@on complete -> @phase beta
@end

@phase beta
## Phase Beta

Sentinel: BETA-SENTINEL-9m2p

@call highlight(This content belongs exclusively to beta)

Tasks:
- Beta task 1
- Beta task 2

@on complete -> @phase gamma
@end

@phase gamma
## Phase Gamma

Sentinel: GAMMA-SENTINEL-4x8q

@call highlight(This content belongs exclusively to gamma)

Tasks:
- Gamma task 1
- Gamma task 2

@on complete -> @phase delta
@end

@phase delta
## Phase Delta

Sentinel: DELTA-SENTINEL-1r6n

@call highlight(This content belongs exclusively to delta)

This is the final phase. No @on complete transition.
@end

---

@prompt
ISOLATION VERIFICATION — run these MCP tool calls and check:

1. list_phases("MDs/tests/test-phase-isolation.md")
   Expected: [{name:"alpha"}, {name:"beta"}, {name:"gamma"}, {name:"delta"}]
   with transitions: alpha->beta, beta->gamma, gamma->delta, delta->null

2. resolve_phase("MDs/tests/test-phase-isolation.md", "alpha")
   Expected content CONTAINS: "ALPHA-SENTINEL-7f3k"
   Expected content DOES NOT CONTAIN: "BETA-SENTINEL-9m2p" or "GAMMA-SENTINEL-4x8q" or "DELTA-SENTINEL-1r6n"
   Expected content CONTAINS: global intro text and the @define highlight macro works

3. resolve_phase("MDs/tests/test-phase-isolation.md", "beta")
   Expected content CONTAINS: "BETA-SENTINEL-9m2p"
   Expected content DOES NOT CONTAIN: any other SENTINEL string

4. resolve_phase("MDs/tests/test-phase-isolation.md", "gamma")
   Expected content CONTAINS: "GAMMA-SENTINEL-4x8q"
   Expected content DOES NOT CONTAIN: any other SENTINEL string

5. resolve_phase("MDs/tests/test-phase-isolation.md", "delta")
   Expected content CONTAINS: "DELTA-SENTINEL-1r6n"
   Expected content DOES NOT CONTAIN: any other SENTINEL string

6. next_phase("MDs/tests/test-phase-isolation.md", "alpha") -> "beta"
7. next_phase("MDs/tests/test-phase-isolation.md", "beta")  -> "gamma"
8. next_phase("MDs/tests/test-phase-isolation.md", "gamma") -> "delta"
9. next_phase("MDs/tests/test-phase-isolation.md", "delta") -> null (phase=null, found=true)

FAIL CONDITIONS:
- Any sentinel string from phase X appears in the resolved output of phase Y
- next_phase returns the wrong phase name
- next_phase on "delta" returns anything other than {phase: null, found: true}
- Global content (intro text, constraint, highlight macro) is absent from any phase
@end
