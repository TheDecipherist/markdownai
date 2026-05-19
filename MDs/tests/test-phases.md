@markdownai v1.0

# Directive Test: @phase Workflow

@prompt
This document tests the @phase directive and phase navigation. Phases should
be listed by the list_phases MCP tool, resolved individually by resolve_phase,
and navigated with next_phase. Claude should use those MCP tools directly to
verify phase support - do not just read this file linearly.

Steps to verify:
1. Call list_phases on this file - should return ["setup", "main", "review"]
2. Call resolve_phase for "setup" - should return content about environment
3. Call next_phase after "setup" - should return "main"
4. Call next_phase after "main" - should return "review"
5. Call next_phase after "review" - should return null/end (no next phase)
@end

---

@phase setup
## Setup Phase

This phase handles environment preparation.

Prerequisites:
- @env USER must be set (currently: @env USER)
- Working directory: @env PWD

@on complete -> @phase main
@end

@phase main
## Main Phase

This is the main execution phase.

The setup phase ran first and confirmed the environment.

Tasks:
1. Load configuration
2. Process inputs
3. Generate outputs

@on complete -> @phase review
@end

@phase review
## Review Phase

Final review before completion.

Summary:
- Setup: done
- Main: done
- Review: in progress

@prompt
Verify: This is the last phase. next_phase after "review" should return null
or an empty/end result - there is no @on complete transition here.
@end
@end
