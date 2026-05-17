import * as vscode from 'vscode';
import {
  MacroInfo,
  parseStdlibMacros,
  scanDocumentMacros,
  isCompletionContext,
} from './macro-registry.js';

const STDLIB_RELATIVE_PATH = 'packages/engine/src/stdlib.md';

export class MacroRegistry {
  private stdlibMacros: MacroInfo[] = [];

  async initialize(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<void> {
    const root = workspaceFolders[0];
    if (!root) return;

    const stdlibUri = vscode.Uri.joinPath(root.uri, STDLIB_RELATIVE_PATH);
    try {
      const bytes = await vscode.workspace.fs.readFile(stdlibUri);
      const content = Buffer.from(bytes).toString('utf8');
      const stdlibPath = stdlibUri.toString();
      this.stdlibMacros = parseStdlibMacros(content).map(m => ({ ...m, filePath: stdlibPath }));
    } catch {
      // stdlib.md not present - extension used outside the MarkdownAI monorepo
    }
  }

  getStdlibMacros(): MacroInfo[] {
    return this.stdlibMacros;
  }

  getMacros(document: vscode.TextDocument): MacroInfo[] {
    const localMacros = scanDocumentMacros(document.getText(), document.uri.toString());
    const importedMacros = this.resolveImportedMacros(document);
    return [...localMacros, ...importedMacros, ...this.stdlibMacros];
  }

  private resolveImportedMacros(document: vscode.TextDocument): MacroInfo[] {
    const text = document.getText();
    const importRe = /^@import\s+(.+)$/gm;
    const macros: MacroInfo[] = [];
    let match: RegExpExecArray | null;

    while ((match = importRe.exec(text)) !== null) {
      const importPath = (match[1] ?? '').trim();
      const docDir = vscode.Uri.joinPath(document.uri, '..');
      const targetUri = vscode.Uri.joinPath(docDir, importPath);

      try {
        const doc = vscode.workspace.textDocuments.find(
          d => d.uri.toString() === targetUri.toString(),
        );
        if (doc) {
          const imported = scanDocumentMacros(doc.getText(), doc.uri.toString());
          macros.push(...imported.map(m => ({ ...m, source: 'imported' as const })));
        }
      } catch {
        // imported file not open in editor - skip
      }
    }

    return macros;
  }
}

export function registerCompletionProvider(
  context: vscode.ExtensionContext,
  registry: MacroRegistry,
): vscode.Disposable {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'markdownai' },
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
      ): vscode.CompletionItem[] {
        const line = document.lineAt(position).text;
        if (!isCompletionContext(line, position.character)) return [];

        const macros = registry.getMacros(document);
        return macros.map(macro => {
          const item = new vscode.CompletionItem(macro.name, vscode.CompletionItemKind.Function);
          if (macro.label) item.detail = `→ {{ ${macro.label} }}`;
          if (macro.description) item.documentation = macro.description;
          item.insertText = macro.name;
          item.sortText =
            macro.source === 'local'
              ? `0_${macro.name}`
              : macro.source === 'imported'
                ? `1_${macro.name}`
                : `2_${macro.name}`;
          return item;
        });
      },
    },
    ' ',
  );

  context.subscriptions.push(provider);
  return provider;
}
