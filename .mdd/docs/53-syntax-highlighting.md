---
id: 53-syntax-highlighting
title: VS Code Extension - Syntax Highlighting Grammar
edition: Both
depends_on: [52-language-definition]
source_files:
  - packages/vscode/syntaxes/markdownai.tmLanguage.json
  - packages/vscode/package.json
routes: []
models: []
test_files:
  - packages/vscode/src/__tests__/grammar.test.ts
data_flow: greenfield
last_synced: 2026-05-17
status: complete
phase: all
mdd_version: 1.6.6
tags: [vscode, extension, grammar, textmate, syntax-highlighting, tmLanguage, directives, interpolation]
path: VS Code Extension/Foundation
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 53 - VS Code Extension - Syntax Highlighting Grammar

## Purpose

Provides distinct colors for every MarkdownAI construct in the editor - directive keywords, `{{ expression }}` interpolations, named parameters, and string values. The rest of each file renders as standard markdown. Users see at a glance which lines are MarkdownAI directives and which are prose.

## Architecture

A TextMate grammar (`syntaxes/markdownai.tmLanguage.json`) registered under the `markdownai` language ID. It handles MarkdownAI-specific syntax and falls through to the embedded `text.html.markdown` grammar for everything else.

Grammar rule precedence (top-to-bottom):
1. YAML frontmatter (`---` ... `---`) - embedded YAML highlighting
2. `@markdownai` header line - `keyword.control.markdownai` scope
3. Directive lines (`@import`, `@define`, etc.) - keyword scope + argument patterns
4. `{{ expression }}` - interpolation scope with inner expression highlighting
5. Embedded markdown - `text.html.markdown`

## Data Model

None - the grammar is a static JSON file.

## API Endpoints

None.

## Business Rules

- Directive keywords: scope `keyword.control.directive.markdownai`
- `@markdownai` header: scope `keyword.control.markdownai` (distinct, applied at document top)
- `{{ ... }}` delimiters: `punctuation.definition.interpolation.begin/end.markdownai`
- Inner expression content: `meta.interpolation.markdownai`
- `match` keyword inside expressions: `keyword.operator.match.markdownai`
- Regex patterns inside `match` expressions: `string.regexp.markdownai`
- Named parameters (e.g. `label=`, `ext=`): `variable.parameter.markdownai`
- String literals in directive args: `string.quoted.double/single.markdownai`
- All other content delegates to `text.html.markdown`
- Grammar embeds `source.yaml` for YAML frontmatter and `text.html.markdown` for prose
- The complete list of directive keywords covered:
  `import include define enddefine call env if elseif else endif query list read http db connect tree date count render phase on graph prompt section chunk-boundary define-concept constraint cache`

## Data Flow

Greenfield.

## Dependencies

Depends on 52-language-definition (the `markdownai` language ID must be registered before the grammar activates).

## Security

None - the grammar is a static configuration file. No user input is processed.

## Known Issues

None.
