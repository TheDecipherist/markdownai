@markdownai v1.0

# Phase Amnesia Test

This document proves that MarkdownAI phases create genuine information barriers.
Each phase contains information that must be completely invisible to every other phase.

If an AI assistant resolves Phase B and can answer questions about Phase A's content,
the phase system has failed. This test makes that failure obvious and undeniable.

@constraint[critical] Each phase may ONLY see its own content plus global content
@constraint[critical] Information from Phase A is completely inaccessible when resolving Phase B
@constraint[high] The @prompt in each phase must be answered using ONLY the current phase's content

---

@phase red

## Phase Red - Classified Information

You are currently in Phase Red. This phase contains classified information.

**Compartment Red Passphrase:** CRIMSON-FALCON-DELTA-9

**Red Team Mission:**
The operation target is the Northbridge server farm. Infiltration window opens at 02:00.
Access code sequence: R-7-7-Alpha-Foxtrot.

**Red-only context:**
- Agent designation: SCARLET
- Exfil point: waypoint-red-12
- Abort signal: three short bursts

@on complete -> @phase blue

@prompt
You are now resolving Phase Red. Answer these questions using ONLY what you can see:

1. What is the Phase Red passphrase?
   Expected: CRIMSON-FALCON-DELTA-9

2. What is the agent designation?
   Expected: SCARLET

3. What is the Phase Blue passphrase?
   Expected: YOU CANNOT KNOW THIS - it is in a different phase you cannot access

4. What is the Phase Green passphrase?
   Expected: YOU CANNOT KNOW THIS - it is in a different phase you cannot access

If you can answer questions 3 or 4, phase isolation has FAILED.
If you can only answer 1 and 2, phase isolation is WORKING.
@end

@end

@phase blue

## Phase Blue - Classified Information

You are currently in Phase Blue. This phase contains classified information.

**Compartment Blue Passphrase:** AZURE-HAWK-SIERRA-3

**Blue Team Mission:**
The operation target is the Eastwall data center. Infiltration window opens at 04:00.
Access code sequence: B-2-2-Bravo-Zulu.

**Blue-only context:**
- Agent designation: COBALT
- Exfil point: waypoint-blue-7
- Abort signal: two long bursts

@on complete -> @phase green

@prompt
You are now resolving Phase Blue. Answer these questions using ONLY what you can see:

1. What is the Phase Blue passphrase?
   Expected: AZURE-HAWK-SIERRA-3

2. What is the agent designation?
   Expected: COBALT

3. What is the Phase Red passphrase?
   Expected: YOU CANNOT KNOW THIS - it is in a different phase you cannot access

4. What is the Phase Green passphrase?
   Expected: YOU CANNOT KNOW THIS - it is in a different phase you cannot access

PROOF CHECK: If the answer to question 3 is "CRIMSON-FALCON-DELTA-9", the phase
boundary has been breached. That value must be completely unknown here.
@end

@end

@phase green

## Phase Green - Classified Information

You are currently in Phase Green. This phase contains classified information.

**Compartment Green Passphrase:** EMERALD-VIPER-ECHO-5

**Green Team Mission:**
The operation target is the Westgate relay station. Infiltration window opens at 06:00.
Access code sequence: G-4-4-Charlie-Kilo.

**Green-only context:**
- Agent designation: JADE
- Exfil point: waypoint-green-4
- Abort signal: alternating short-long

This is the final phase. The operation concludes here.

@prompt
You are now resolving Phase Green. Answer these questions using ONLY what you can see:

1. What is the Phase Green passphrase?
   Expected: EMERALD-VIPER-ECHO-5

2. What is the agent designation?
   Expected: JADE

3. What is the Phase Red passphrase?
   Expected: YOU CANNOT KNOW THIS

4. What is the Phase Blue passphrase?
   Expected: YOU CANNOT KNOW THIS

5. What were the combined passphrases from all three phases?
   Expected: YOU CAN ONLY STATE THE GREEN ONE. Red and Blue are inaccessible.

COMPLETE ISOLATION CHECK: If you can name even one value from Red or Blue above,
the phase system has a leak. The correct answer is that those values simply do not
exist in the context you received.
@end

@end

---

@prompt
## MCP Tool Verification Steps

Run these tools and verify the output carefully:

### Step 1 - List phases
list_phases("MDs/tests/test-phase-amnesia.md")
Expected: [{name:"red"}, {name:"blue"}, {name:"green"}]
with transitions: red->blue, blue->green, green->null

### Step 2 - Resolve Phase Red
resolve_phase("MDs/tests/test-phase-amnesia.md", "red")

The output MUST:
- Contain "CRIMSON-FALCON-DELTA-9"
- Contain "SCARLET"
- NOT contain "AZURE-HAWK-SIERRA-3"
- NOT contain "COBALT"
- NOT contain "EMERALD-VIPER-ECHO-5"
- NOT contain "JADE"

### Step 3 - Resolve Phase Blue
resolve_phase("MDs/tests/test-phase-amnesia.md", "blue")

The output MUST:
- Contain "AZURE-HAWK-SIERRA-3"
- Contain "COBALT"
- NOT contain "CRIMSON-FALCON-DELTA-9"
- NOT contain "SCARLET"
- NOT contain "EMERALD-VIPER-ECHO-5"
- NOT contain "JADE"

### Step 4 - Resolve Phase Green
resolve_phase("MDs/tests/test-phase-amnesia.md", "green")

The output MUST:
- Contain "EMERALD-VIPER-ECHO-5"
- Contain "JADE"
- NOT contain "CRIMSON-FALCON-DELTA-9"
- NOT contain "AZURE-HAWK-SIERRA-3"

### What This Proves
When Claude uses resolve_phase(), it receives ONLY the named phase's body
plus the global content (intro, constraints, macros). All other phase bodies
are filtered out at the engine level before the content ever reaches Claude.
This is not an honor system - the engine never sends the other content at all.
@end
