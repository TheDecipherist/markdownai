@markdownai v1.0

# Directive Test: @include and @import

@prompt
This document tests file composition directives. @include inlines content
at the directive site. @import brings in definitions (macros) without
rendering their content. Verify each section's expected output.
@end

---

## @include - Inline File Content

The following content is included from test-includable.md:

@include test-includable.md

@prompt
Verify: The text "This content is included from test-includable.md." appears
above, along with the three-item list. The @env and @date in the included file
should also be resolved (not shown as raw directives).
@end

---

## @import - Import Definitions Only

@import test-macros-shared.md

Using imported macros:

@call sharedGreet(World)
@call sharedBadge(IMPORTED)

@prompt
Verify: The @import line itself produces no visible output (no heading, no
content from test-macros-shared.md appears here). But the two @call lines
should work and output:
- "Greetings from shared library, World!"
- "<<IMPORTED>>"
@end

---

## Chained Include

@include test-includable.md

@prompt
Verify: The same included content appears a second time here without error
(MarkdownAI does not block repeated includes of the same file).
@end
