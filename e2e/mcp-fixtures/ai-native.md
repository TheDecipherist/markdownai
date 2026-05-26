@markdownai

@prompt role="context"
This document describes the MarkdownAI rendering pipeline.
All file paths are relative to the document root (jailRoot).
@prompt-end

@define-concept jailRoot "the document root directory, used to confine file include and read paths"
@define-concept strictMode "when --strict is active, any warning becomes a fatal error"

@constraint id="no-eval" severity="critical"
eval() is never used. Use vm.runInNewContext() for all expression evaluation.
@constraint-end

@constraint id="no-traversal" severity="critical"
File paths must never escape the jailRoot. ../ sequences are always blocked.
@constraint-end

@section priority="critical"
## Core Architecture
The parser produces an AST. The engine walks it. Output is rendered markdown.
@section-end

@section priority="low"
## Historical Background
MarkdownAI was created in 2026 as a documentation superset of standard markdown.
@section-end

@chunk-boundary id="core" standalone="true"

@phase implementation
## Implementation Phase
Key implementation details for the rendering pipeline.
@on-complete @phase review /
@phase-end

@phase review
## Review Phase
Final review criteria and acceptance conditions.
@phase-end
