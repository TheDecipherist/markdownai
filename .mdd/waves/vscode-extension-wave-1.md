---
id: vscode-extension-wave-1
title: "Wave 1: Foundation"
initiative: vscode-extension
initiative_version: 1
status: planned
depends_on: none
demo_state: "Open a .md file with @markdownai - directives, {{ }} interpolations, and macro names light up in distinct colors. Snippets available via tab."
created: 2026-05-17
hash:
---

# Wave 1: Foundation

## Demo-State

Open a `.md` file whose first line is `@markdownai`. Every directive keyword (`@import`, `@define`, `@call`, `@if`, `@query`, etc.), every `{{ expression }}`, and every named parameter (`label=`, `ext=`) is colored distinctly. Common patterns are available as tab-expanded snippets.

*(This wave is not complete until this can be manually demonstrated.)*

## Features

| # | Feature | Doc | Status | Depends on |
|---|---------|-----|--------|------------|
| 1 | package-scaffold | - | planned | - |
| 2 | language-definition | - | planned | package-scaffold |
| 3 | syntax-highlighting | - | planned | language-definition |
| 4 | snippets | - | planned | language-definition |

## Open Research

- VS Code grammar injection vs embedded language: decide whether to define a new `markdownai` language ID that embeds markdown grammar, or use injection grammar to augment the standard markdown grammar. **Decision: new language ID that embeds markdown.** This gives full control over tokenization and avoids injection conflicts with other markdown extensions.
- Language mode switching: the extension watches `.md` file opens and checks line 1 for `@markdownai`, then calls `vscode.languages.setTextDocumentLanguage()` to switch to `markdownai`. This is the cleanest pattern for content-based language detection.
