@markdownai

## Quick Start Guide

To use MarkdownAI, start any document with the `@markdownai` header. Then use directives
to pull in live data from files, environment variables, and your filesystem.

Key capabilities:
- **File inclusion** — embed another document inline at the point of the directive
- **Environment** — read environment variables with optional fallback values
- **Data reading** — extract values from JSON, YAML, TOML, or CSV files
- **File listing** — list files matching a glob pattern and format them as markdown
- **Conditional rendering** — show or hide sections based on runtime conditions

This guide is pulled in from a separate section file, demonstrating cross-file composition.
