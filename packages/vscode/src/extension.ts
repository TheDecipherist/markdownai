import * as vscode from 'vscode';
import { shouldSwitchToMarkdownAI } from './language-detection.js';
import { MacroRegistry, registerCompletionProvider } from './providers/completion-provider.js';
import { registerHoverProvider } from './providers/hover-provider.js';
import { registerDefinitionProvider } from './providers/definition-provider.js';
import { registerReferenceProvider } from './providers/reference-provider.js';
import { DiagnosticsProvider } from './providers/diagnostics-provider.js';
import { PreviewProvider, PREVIEW_SCHEME, toPreviewUri } from './providers/preview-provider.js';

const registry = new MacroRegistry();

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => handleDocument(doc)),
  );
  vscode.workspace.textDocuments.forEach(doc => handleDocument(doc));

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
