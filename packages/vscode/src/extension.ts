import * as vscode from 'vscode';
import { shouldSwitchToMarkdownAI } from './language-detection';
import { MacroRegistry, registerCompletionProvider } from './providers/completion-provider.js';
import { registerHoverProvider } from './providers/hover-provider.js';
import { registerDefinitionProvider } from './providers/definition-provider.js';
import { registerReferenceProvider } from './providers/reference-provider.js';

const registry = new MacroRegistry();

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => handleDocument(doc)),
  );
  vscode.workspace.textDocuments.forEach(doc => handleDocument(doc));

  void registry.initialize(vscode.workspace.workspaceFolders ?? []);
  registerCompletionProvider(context, registry);
  registerHoverProvider(context, registry);
  registerDefinitionProvider(context, registry);
  registerReferenceProvider(context, registry);
}

export function deactivate(): void {
  // nothing to clean up
}

function handleDocument(doc: vscode.TextDocument): void {
  if (doc.lineCount === 0) return;
  const firstLine = doc.lineAt(0).text;
  if (shouldSwitchToMarkdownAI(doc.languageId, firstLine)) {
    void vscode.languages.setTextDocumentLanguage(doc, 'markdownai');
  }
}
