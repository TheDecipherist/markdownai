@markdownai v1.0

# Directive Test: Rendering Directives

@prompt
This document tests directives that produce structured output. All file paths
are relative to this file's directory (MDs/tests/). Verify each section
produces real output rather than raw directive syntax.
@end

---

## @list - Directory Listing

All test files in this directory:
@list .

Markdown files only:
@list . match="*.md"

@prompt
Verify:
- First block shows all files in MDs/tests/ (including fixtures/)
- Second block shows only .md files
- Neither block shows literal "@list" syntax
@end

---

## @list with Pipe - Sorted and Limited

Sorted, first 3:
@list . match="*.md" | sort | head -n 3

Count of markdown files:
@list . match="*.md" | wc -l

@prompt
Verify:
- First 3 .md files alphabetically (README.md, test-basics.md, test-http.md)
- The count line shows a number (8 or more)
@end

---

## @tree - Directory Tree

Test suite directory tree:
@tree . depth=1

@prompt
Verify: A tree of the MDs/tests/ directory appears. Should show test files and
the fixtures/ subdirectory.
@end

---

## @count - Line Count

@count README.md

@prompt
Verify: A single number appears - the line count of README.md (60+ lines).
@end

---

## @read - Read File Contents

Shared macro file (raw content):
@read test-macros-shared.md

@prompt
Verify: The raw content of test-macros-shared.md appears, including @define
blocks. @read outputs file content without rendering directives.
@end

---

## ```mai-graph``` - Phase Graph (Visual Only)

```mai-graph
setup -> main -> review -> done
```

@prompt
Verify: The graph content renders. This is VISUAL ONLY - @graph does not
control phase sequencing (that is @on complete). No error.
@end

---

## @chunk-boundary - Explicit Split Points

First chunk content.

@chunk-boundary

Second chunk content after the boundary.

@chunk-boundary

Third chunk content.

@prompt
Verify: All three content blocks appear. Boundary markers may appear as
horizontal rules in standard format, stripped in ai format.
@end

---

## @chunk-boundary Notes

The boundaries above render as HTML comments (`<!-- chunk: chunk-N -->`).
In ai format they are stripped entirely. The content between boundaries
is never lost in either format.
