import * as vscode from 'vscode';
import { shouldSwitchToMarkdownAI } from './language-detection.js';
import { MacroRegistry, registerCompletionProvider } from './providers/completion-provider.js';
import { registerHoverProvider } from './providers/hover-provider.js';
import { registerDefinitionProvider } from './providers/definition-provider.js';
import { registerReferenceProvider } from './providers/reference-provider.js';
import { DiagnosticsProvider } from './providers/diagnostics-provider.js';
import { PreviewProvider, PREVIEW_SCHEME, toPreviewUri } from './providers/preview-provider.js';

const BLOCK_OPENERS = /^(\s*)@(phase|define|note|section|prompt)\b/;
const IF_OPENER = /^(\s*)@if\b/;

const registry = new MacroRegistry();

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => handleDocument(doc)),
  );
  vscode.workspace.textDocuments.forEach(doc => handleDocument(doc));

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId !== 'markdownai') return;
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== event.document) return;

      for (const change of event.contentChanges) {
        if (!change.text.startsWith('\n') && !change.text.startsWith('\r\n')) continue;

        const sourceLineNum = change.range.start.line;
        const doc = event.document;
        const lineText = doc.lineAt(sourceLineNum).text.trimEnd();

        // Only auto-close when Enter was pressed at the end of the directive line
        if (change.range.start.character < lineText.length) continue;

        const blockMatch = BLOCK_OPENERS.exec(lineText);
        const ifMatch = !blockMatch ? IF_OPENER.exec(lineText) : null;
        if (!blockMatch && !ifMatch) continue;

        const indent = (blockMatch ?? ifMatch)![1] ?? '';
        const closer = blockMatch ? '@end' : '@endif';
        const cursorLine = sourceLineNum + 1;

        // Don't insert if closer already exists immediately after the body line
        if (cursorLine + 1 < doc.lineCount) {
          const nextText = doc.lineAt(cursorLine + 1).text.trim();
          if (nextText === closer) continue;
        }

        void editor.edit(eb => {
          const bodyLineLen = doc.lineAt(Math.min(cursorLine, doc.lineCount - 1)).text.length;
          eb.insert(new vscode.Position(cursorLine, bodyLineLen), `\n${indent}${closer}`);
        }, { undoStopBefore: false, undoStopAfter: false }).then(success => {
          if (!success) return;
          // Keep cursor on the body line (between directive and @end)
          const bodyLen = editor.document.lineAt(cursorLine).text.length;
          const bodyPos = new vscode.Position(cursorLine, bodyLen);
          editor.selection = new vscode.Selection(bodyPos, bodyPos);
        });
      }
    }),
  );

  registry.initialize(vscode.workspace.workspaceFolders ?? []).catch((err: unknown) => {
    console.error('[markdownai] registry initialization failed:', err)
  });
  registerCompletionProvider(context, registry);
  registerHoverProvider(context, registry);
  registerDefinitionProvider(context, registry);
  registerReferenceProvider(context, registry);
  new DiagnosticsProvider(registry).register(context);

  const previewProvider = new PreviewProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, previewProvider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownai.openPreview', async (uri?: vscode.Uri) => {
      const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!fileUri) return;
      const previewUri = toPreviewUri(fileUri);
      await vscode.commands.executeCommand('markdown.showPreviewToSide', previewUri);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'markdownai') {
        previewProvider.refresh(toPreviewUri(doc.uri));
      }
    }),
  );
}

export function deactivate(): void {
  // nothing to clean up
}

function handleDocument(doc: vscode.TextDocument): void {
  if (doc.lineCount === 0) return;
  if (shouldSwitchToMarkdownAI(doc.languageId, doc.getText())) {
    void vscode.languages.setTextDocumentLanguage(doc, 'markdownai');
  }
}
