---
id: 79-vscode-preview
title: VS Code Extension - Live Preview
edition: VS Code Extension
depends_on: [51-package-scaffold, 32-cli-complete]
source_files:
  - packages/vscode/src/providers/preview-provider.ts
  - packages/vscode/src/extension.ts
  - packages/vscode/package.json
last_synced: 2026-05-18
status: complete
mdd_version: 1
tags: [vscode, extension, preview, live-preview, mai-render, content-provider, markdownai]
path: VS Code Extension/Intelligence
integration_contracts: []
satisfies_contracts: []
known_issues: []
---

# 79 - VS Code Extension - Live Preview

## Purpose

Renders any open MarkdownAI document inside VS Code's built-in Markdown preview panel, with auto-refresh on save. Lets users see exactly what `mai render` produces without leaving the editor - useful for learning the syntax and verifying output while writing.

## Architecture

Two pieces registered in `extension.ts activate()`:

**`preview-provider.ts`** - implements `vscode.TextDocumentContentProvider` on the `markdownai-preview:` URI scheme. When VS Code requests content for a `markdownai-preview:/path/to/file.md` URI, the provider strips the scheme back to `file:`, resolves the path, and runs `mai render "<path>"` as a child process. The stdout is returned as the document content. On error, a formatted Markdown error message is returned so the preview panel never goes blank.

**Command + menus** - The `markdownai.openPreview` command converts the active file's URI to a `markdownai-preview:` URI and calls `markdown.showPreviewToSide` on it. VS Code's built-in Markdown preview engine handles rendering, theming, and scroll sync. No custom WebviewPanel is needed.

**Auto-refresh** - `onDidSaveTextDocument` fires `PreviewProvider._onDidChange` whenever a `markdownai` file is saved. VS Code's preview panel listens to `onDidChange` on the content provider and re-fetches automatically.

```
User saves file
  → onDidSaveTextDocument
    → PreviewProvider.refresh(previewUri)
      → _onDidChange fires
        → VS Code preview re-fetches markdownai-preview:/path
          → exec("mai render <path>")
            → rendered markdown returned
              → VS Code markdown renderer updates panel
```

## Business Rules

- URI scheme: `markdownai-preview:` — path segment is identical to the source file path
- Command ID: `markdownai.openPreview`
- Menu locations: `editor/title` (icon, navigation group), `editor/title/context` (tab right-click), `editor/context` (editor right-click)
- `when` clause: `resourceLangId == markdownai` — only shown on detected MarkdownAI files
- Opens preview to the side (`markdown.showPreviewToSide`) - does not replace the source editor
- `mai render` timeout: 15 seconds — prevents hanging on documents with slow network/DB directives
- Error display: render failures show a Markdown-formatted error block in the preview panel, never a VS Code notification or crash
- Auto-refresh scope: only files with `languageId === 'markdownai'` trigger a refresh on save; plain markdown files do not
- The provider does not write any files or cache render output — every preview open and every save triggers a fresh render

## Known Issues

(none)
