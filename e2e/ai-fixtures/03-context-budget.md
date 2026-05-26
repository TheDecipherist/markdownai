@markdownai

# Context Budget Demo

@section priority="critical"
## Critical: System Architecture

The parser converts source markdown into an AST.
The engine walks the AST and executes all directives.
This section is always included regardless of budget constraints.
Critical information must never be dropped.
@section-end

@section priority="high" id="config"
## High Priority: Configuration

Configure the engine using the security configuration file.
Shell commands require explicit allow-listing in the config.
High-priority content is included unless the budget is very tight.
@section-end

@section priority="medium"
## Medium Priority: Examples

Example: include directives resolve to static content inline.
Medium-priority sections are dropped when budget is tight.
@section-end

@section priority="low"
## Low Priority: Historical Background

MarkdownAI was designed in early 2026 as a documentation superset.
This section provides historical context only.
It is the first to be dropped when context budget is constrained.
@section-end

@chunk-boundary id="architecture" standalone="true"

Final notes: always run `mai validate` before deployment.
