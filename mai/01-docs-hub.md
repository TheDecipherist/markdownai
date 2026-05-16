@markdownai

# MarkdownAI Documentation Hub

> Documentation that cannot lie — built with MarkdownAI.

@define welcome_banner(project)
---
Welcome to **{{ project }}** — the live documentation system.
---
@end

@call welcome_banner(project=MarkdownAI)

@include ./sections/intro.md

@include ./sections/guide.md

## Status

@if true
This document was rendered successfully with all directives resolved.
@else
This section should never appear.
@endif

## Current Date

This document was last rendered on:

@date format="YYYY-MM-DD"

## Environment

@env MARKDOWNAI_ENV fallback="development"

@define footer(version)
---
_MarkdownAI v{{ version }} — documentation as code._
---
@end

@call footer(version=1.0.0)
