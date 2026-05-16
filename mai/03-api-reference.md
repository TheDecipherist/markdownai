@markdownai

@import ./shared/macros.md

# MarkdownAI API Reference

## Overview

@call section_header(title=Directives, subtitle=Complete directive reference for MarkdownAI)

MarkdownAI provides a rich set of directives for live documentation.

## Stable Features

@call feature_status(name=Parser, status=stable)
@call feature_status(name=Renderer, status=stable)
@call feature_status(name=Engine, status=stable)

## Project Badges

@call badge(label=Version, value=1.0.0)

@call badge(label=Status, value=production-ready)

## Phase: Development

@phase development

This section is for development builds. It includes debugging information
and internal API details not shown in the production reference.

@end

## Phase: Production

@phase production

This section covers the stable public API surface. All directives listed here
are production-ready and covered by semantic versioning.

@end

## Shared Macro Files

@list ./shared match="*.md" | sort | @render type="list"
