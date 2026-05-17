import * as vscode from 'vscode';
import { shouldSwitchToMarkdownAI } from './language-detection';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => handleDocument(doc)),
  );
  vscode.workspace.textDocuments.forEach(doc => handleDocument(doc));
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
