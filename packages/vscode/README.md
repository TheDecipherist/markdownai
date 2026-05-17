# MarkdownAI for VS Code

MarkdownAI is a superset of Markdown that makes documents live. Directives like `@call`, `@if`, and `@define` turn static docs into documents that run queries, resolve environment values, and render conditionally.

This extension activates automatically on any `.md` file whose first line is `@markdownai`. No configuration needed.

## Features

### Syntax Highlighting

Directives, `{{ }}` interpolations, and macro names each get their own color scope. The grammar embeds standard Markdown highlighting for prose sections, so the rest of your document looks normal.

### Snippets

Type a directive prefix and press Tab. Every directive has a snippet with placeholder fields:

| Prefix | Inserts |
|--------|---------|
| `@if` | `@if {{ condition }}`...`@endif` block |
| `@define` | `@define name` with `@end` |
| `@call` | `@call macro-name` |
| `@env` | `@env VAR_NAME` with optional fallback |
| `@include` | `@include path/to/file.md` |
| `@query` | `@query command label=varname` |
| `@phase` | `@phase name` with `@end` |

### Autocomplete

Type `@call ` (with a space) and the extension suggests every macro defined in the current file, any imported files, and the MarkdownAI stdlib. Each suggestion shows the macro's description and the label variable it sets.

### Hover Documentation

Hover over any `@call macro-name` to see the macro's description and what variable it sets (`{{ label_name }}`). Works for local macros, imported macros, and stdlib macros.

### Go to Definition

Cmd+click (or F12) on any `@call macro-name` or `@define macro-name` jumps to the `@define` block where that macro is defined, even if it is in a different file.

### Reference Panel

Right-click any `@define` line and choose "Find All References" to see every `@call` site that uses that macro across the workspace. Shows inline in the editor with a count badge.

### Diagnostics

Structural errors show as red squiggles. Undefined macro references show as yellow warnings.

**Red squiggles (errors):**
- `@if` block without a matching `@endif`
- `@define` or `@phase` block without a matching `@end`

**Yellow warnings:**
- `@call some-macro` where `some-macro` is not defined in the document, imported files, or stdlib

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `markdownai.diagnostics.enabled` | `true` | Enable or disable all diagnostics |
| `markdownai.diagnostics.warnUndefinedMacros` | `true` | Warn when `@call` references an unknown macro |
| `markdownai.stdlibPath` | `packages/engine/src/stdlib.md` | Path to the stdlib definitions file, relative to workspace root |

## Requirements

- VS Code 1.85 or later
- No other extensions required

## How It Activates

The extension registers as a language for files that start with `@markdownai` on the first line. Open any such file and all features activate immediately. Files without that header are treated as plain Markdown.

## Publishing

To package the extension locally:

```bash
npm run package -w packages/vscode
```

This produces a `.vsix` file you can install with "Install from VSIX" in VS Code. Marketplace publishing requires a publisher account and is handled separately.
