import * as vscode from 'vscode';
import {
  MacroInfo,
  parseStdlibMacros,
  scanDocumentMacros,
  isCompletionContext,
} from './macro-registry.js';

const STDLIB_RELATIVE_PATH = 'packages/engine/src/stdlib.md';

interface DirectiveCompletion {
  label: string;
  snippet: string;
  doc: string;
  kind: vscode.CompletionItemKind;
}

const BLOCK_DIRECTIVES: DirectiveCompletion[] = [
  {
    label: '@phase',
    snippet: '@phase ${1:name}\n  $0\n@end',
    doc: 'Named phase block — resolved individually via resolve_phase()',
    kind: vscode.CompletionItemKind.Class,
  },
  {
    label: '@define',
    snippet: '@define ${1:name}(${2:args})\n  $0\n@end',
    doc: 'Macro definition — reference params with {{ args }}',
    kind: vscode.CompletionItemKind.Function,
  },
  {
    label: '@prompt',
    snippet: '@prompt\n  $0\n@end',
    doc: 'AI instruction block — stripped from non-AI renders',
    kind: vscode.CompletionItemKind.Event,
  },
  {
    label: '@section',
    snippet: '@section ${1:name}\n  $0\n@end',
    doc: 'Named section block',
    kind: vscode.CompletionItemKind.Module,
  },
  {
    label: '@note',
    snippet: '@note\n  $0\n@end',
    doc: 'Note block — body hidden by default, use @note visible to show',
    kind: vscode.CompletionItemKind.Text,
  },
  {
    label: '@note visible',
    snippet: '@note visible\n  $0\n@end',
    doc: 'Visible note block — rendered as a blockquote',
    kind: vscode.CompletionItemKind.Text,
  },
  {
    label: '@if',
    snippet: '@if ${1:condition}\n  $0\n@endif',
    doc: 'Conditional block — closes with @endif',
    kind: vscode.CompletionItemKind.Keyword,
  },
  {
    label: '@if/@else',
    snippet: '@if ${1:condition}\n  $2\n@else\n  $3\n@endif',
    doc: 'Conditional block with fallback branch',
    kind: vscode.CompletionItemKind.Keyword,
  },
];

const INLINE_DIRECTIVES: DirectiveCompletion[] = [
  {
    label: '@call',
    snippet: '@call ${1:macro-name}(${2:args})',
    doc: 'Invoke a defined macro',
    kind: vscode.CompletionItemKind.Function,
  },
  {
    label: '@include',
    snippet: '@include ${1:./path/to/file.md}',
    doc: 'Inline the rendered content of another file',
    kind: vscode.CompletionItemKind.File,
  },
  {
    label: '@import',
    snippet: '@import ${1:./path/to/file.md}',
    doc: 'Import macro definitions from another file (no content rendered)',
    kind: vscode.CompletionItemKind.Reference,
  },
  {
    label: '@env',
    snippet: '@env ${1:VAR_NAME}',
    doc: 'Inject an environment variable value',
    kind: vscode.CompletionItemKind.Variable,
  },
  {
    label: '@constraint',
    snippet: '@constraint[${1|critical,high,medium,low|}] ${2:rule text}',
    doc: 'Machine-readable constraint rule — single-line, no @end',
    kind: vscode.CompletionItemKind.Interface,
  },
  {
    label: '@define-concept',
    snippet: '@define-concept ${1:Name} "${2:definition}"',
    doc: 'Single-line glossary entry — multi-word definition must be quoted',
    kind: vscode.CompletionItemKind.Interface,
  },
  {
    label: '@on complete',
    snippet: '@on complete -> @phase ${1:next-phase}',
    doc: 'Phase transition directive — goes inside a @phase block',
    kind: vscode.CompletionItemKind.Event,
  },
  {
    label: '@read',
    snippet: '@read ${1:./path/to/file.txt}',
    doc: 'Read and inline raw file content (no directive rendering)',
    kind: vscode.CompletionItemKind.File,
  },
  {
    label: '@list',
    snippet: '@list ${1:.} match="${2:*}"',
    doc: 'Directory listing — supports match= and pipe chains',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@tree',
    snippet: '@tree ${1:.} depth=${2:1}',
    doc: 'ASCII directory tree',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@count',
    snippet: '@count ${1:./file.md}',
    doc: 'Line count of a file',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@http',
    snippet: '@http url=${1:https://api.example.com/endpoint}',
    doc: 'HTTP GET request — requires allowHttp=true, cloud metadata always blocked',
    kind: vscode.CompletionItemKind.Interface,
  },
  {
    label: '@chunk-boundary',
    snippet: '@chunk-boundary',
    doc: 'Explicit chunk split point',
    kind: vscode.CompletionItemKind.Operator,
  },
];

function buildDirectiveItem(d: DirectiveCompletion, index: number): vscode.CompletionItem {
  const item = new vscode.CompletionItem(d.label, d.kind);
  item.insertText = new vscode.SnippetString(d.snippet);
  item.documentation = new vscode.MarkdownString(d.doc);
  item.sortText = `0_${String(index).padStart(3, '0')}_${d.label}`;
  return item;
}

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
  // Directive completions — triggered on '@'
  const directiveProvider = vscode.languages.registerCompletionItemProvider(
    { language: 'markdownai' },
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
      ): vscode.CompletionItem[] {
        const line = document.lineAt(position).text.slice(0, position.character);
        if (!line.trimStart().startsWith('@')) return [];

        const allDirectives = [...BLOCK_DIRECTIVES, ...INLINE_DIRECTIVES];
        return allDirectives.map((d, i) => buildDirectiveItem(d, i));
      },
    },
    '@',
  );

  // Macro call completions — triggered on space (existing behaviour)
  const macroProvider = vscode.languages.registerCompletionItemProvider(
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
          if (macro.label) item.detail = `-> {{ ${macro.label} }}`;
          if (macro.description) item.documentation = macro.description;
          item.insertText = macro.name;
          item.sortText =
            macro.source === 'local'
              ? `1_${macro.name}`
              : macro.source === 'imported'
                ? `2_${macro.name}`
                : `3_${macro.name}`;
          return item;
        });
      },
    },
    ' ',
  );

  context.subscriptions.push(directiveProvider, macroProvider);
  return directiveProvider;
}
