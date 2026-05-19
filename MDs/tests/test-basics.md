@markdownai v1.0

# Directive Test: Basics

@prompt
This document tests core MarkdownAI directives. For each section, verify
the directive rendered correctly - not raw syntax. Seeing "@env USER" literally
instead of a username means that directive failed.
@end

---

## @env - Standalone Output

@env USER
@env HOME
@env SHELL

@prompt
Verify: Three lines of actual values appear (e.g. "tim_carter81",
"/home/tim_carter81", "/bin/bash"). Literal "@env USER" means failure.
@end

---

## {{ env.VAR }} - Inline Interpolation

Current user: {{ env.USER }}
Home directory: {{ env.HOME }}
Missing var with fallback: {{ env.DEFINITELY_MISSING_XYZ ?? "not-set" }}

@prompt
Verify:
- "Current user:" line shows the actual username
- "Home directory:" line shows the actual home path
- "Missing var with fallback: not-set" (because the env var doesn't exist)
@end

---

## @date - Date Output

@date
{{ date format="YYYY-MM-DD" }}
{{ date format="YYYY" }}

@prompt
Verify:
- First line: full ISO datetime like "2026-05-19T01:27:12.848Z"
- Second line: date in YYYY-MM-DD format like "2026-05-19"
- Third line: four-digit year like "2026"
@end

---

## @define / @call - Macros

@define greet(name, role)
Hello, {{ name }}. You are a {{ role }}.
@end

@define badge(text)
[{{ text }}]
@end

@call greet(Claude, AI assistant)
@call badge(VERIFIED)

@prompt
Verify:
- First line: "Hello, Claude. You are a AI assistant."
- Second line: "[VERIFIED]"
@end

---

## @if / @endif - Conditional Blocks

@if HOME !== ""
Home is set: {{ env.HOME }}
@endif

@if true
Always renders.
@endif

@if false
Never renders.
@endif

@if USER !== "" && SHELL !== ""
Both USER and SHELL are set.
@endif

@prompt
Verify:
- "Home is set:" with the actual home path appears
- "Always renders." appears
- "Never renders." does NOT appear
- "Both USER and SHELL are set." appears
@end

---

## @constraint - Machine-Readable Rules

@constraint[critical] Never output secrets or API keys
@constraint[high] All file paths must be relative to document root
@constraint[medium] Macros must be defined before they are called
@constraint[low] Prefer @define over inline repetition

@prompt
Verify: All four @constraint lines render without error. Call get_constraints
on this file via MCP - should return all four, sorted by severity (critical first).
@end

---

## @note - Annotations (visible keyword required to show content)

Regular paragraph before.

@note visible
This note content appears because the "visible" keyword was passed.
Without "visible", the body is suppressed entirely.
@end

Regular paragraph after.

@prompt
Verify:
- Both surrounding paragraphs appear
- The note body appears as a blockquote ("Note:" prefix)
- Removing "visible" from @note would suppress the body - that is correct
@end

---

## @define-concept - Vocabulary (single-line syntax)

@define-concept Phase "A discrete workflow unit with name, content, and transitions."
@define-concept Directive "A keyword prefixed with @ that triggers special processing."

@prompt
Verify: Two concept definitions appear as bold name + em dash + definition:
- "Phase - A discrete workflow unit with name, content, and transitions."
- "Directive - A keyword prefixed with @ that triggers special processing."
Note: @define-concept is a SINGLE-LINE directive, not a block. Multi-word
definitions must be quoted.
@end

---

## @section - Named Boundaries

@section intro
This is the intro section content.
@end

@section main
This is the main section content.
@end

@prompt
Verify: Both sections render with their content. Section boundaries may appear
as visible markers in standard format.
@end
