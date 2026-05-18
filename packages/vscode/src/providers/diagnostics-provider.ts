import * as vscode from 'vscode';
import type { MacroRegistry } from './completion-provider.js';
import { analyzeDiagnostics } from './diagnostics-engine.js';
import { readSettings } from '../settings.js';

export type { DiagnosticInfo } from './diagnostics-engine.js';

export class DiagnosticsProvider {
  private readonly collection: vscode.DiagnosticCollection;
  private readonly registry: MacroRegistry;

  constructor(registry: MacroRegistry) {
    this.registry = registry;
    this.collection = vscode.languages.createDiagnosticCollection('markdownai');
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      this.collection,
      vscode.workspace.onDidOpenTextDocument(doc => this.analyzeDocument(doc)),
      vscode.workspace.onDidChangeTextDocument(e => this.analyzeDocument(e.document)),
      vscode.workspace.onDidCloseTextDocument(doc => this.collection.delete(doc.uri)),
    );
    vscode.workspace.textDocuments.forEach(doc => this.analyzeDocument(doc));
  }

  private analyzeDocument(doc: vscode.TextDocument): void {
    if (doc.languageId !== 'markdownai') return;
    try {
      const config = vscode.workspace.getConfiguration('markdownai');
      const settings = readSettings(key => config.get(key));
      if (!settings.diagnosticsEnabled) {
        this.collection.delete(doc.uri);
        return;
      }
      const macros = this.registry.getMacros(doc);
      const knownNames = settings.warnUndefinedMacros ? macros.map(m => m.name) : null;
      const infos = analyzeDiagnostics(doc.getText(), knownNames ?? []);
      const filtered = knownNames === null
        ? infos.filter(d => d.severity === 'error')
        : infos;
      const diagnostics = filtered.map(info => {
        const range = new vscode.Range(info.line, info.startChar, info.line, info.endChar);
        const sev = info.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;
        return new vscode.Diagnostic(range, info.message, sev);
      });
      this.collection.set(doc.uri, diagnostics);
    } catch (err) {
      console.error('[markdownai] diagnostics analysis failed for', doc.uri.toString(), ':', err)
      this.collection.delete(doc.uri);
    }
  }
}
