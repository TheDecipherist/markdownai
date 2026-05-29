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
    snippet: '@phase ${1:name}\n  $0\n@phase-end',
    doc: 'Named phase block — resolved individually via resolve_phase()',
    kind: vscode.CompletionItemKind.Class,
  },
  {
    label: '@define',
    snippet: '@define ${1:name}(${2:args})\n  $0\n@define-end',
    doc: 'Macro definition — reference params with {{ args }}',
    kind: vscode.CompletionItemKind.Function,
  },
  {
    label: '@prompt',
    snippet: '@prompt\n  $0\n@prompt-end',
    doc: 'AI instruction block — stripped from non-AI renders',
    kind: vscode.CompletionItemKind.Event,
  },
  {
    label: '@section',
    snippet: '@section ${1:name}\n  $0\n@section-end',
    doc: 'Named section block',
    kind: vscode.CompletionItemKind.Module,
  },
  {
    label: '@note',
    snippet: '@note\n  $0\n@note-end',
    doc: 'Note block — body hidden by default, use @note visible to show',
    kind: vscode.CompletionItemKind.Text,
  },
  {
    label: '@note visible',
    snippet: '@note visible\n  $0\n@note-end',
    doc: 'Visible note block — rendered as a blockquote',
    kind: vscode.CompletionItemKind.Text,
  },
  {
    label: '@if',
    snippet: '@if ${1:condition}\n  $0\n@if-end',
    doc: 'Conditional block — closes with @if-end',
    kind: vscode.CompletionItemKind.Keyword,
  },
  {
    label: '@if/@else',
    snippet: '@if ${1:condition}\n  $2\n@else\n  $3\n@if-end',
    doc: 'Conditional block with fallback branch',
    kind: vscode.CompletionItemKind.Keyword,
  },
  {
    label: '@foreach',
    snippet: '@foreach ${1:item} in ${2:@list ./path match="*.md"}\n  $0\n@foreach-end',
    doc: 'Iteration block — body renders once per item. Source can be a directive, frontmatter list field, label, or comma-CSV literal. (v1.0+)',
    kind: vscode.CompletionItemKind.Keyword,
  },
  {
    label: '@render-template',
    snippet: '@render-template from="${1:./template.md}" to="${2:./output.md}"\n  ${3:key}=${4:value}\n@render-template-end',
    doc: 'Render a template with injected parameters and write to disk. Idempotent by default; force overwrites. Requires filesystem.write_enabled. (v1.0+)',
    kind: vscode.CompletionItemKind.Class,
  },
  {
    label: '@data',
    snippet: '@data ${1:name}\n  ${2:key} = ${3:value}\n@data-end',
    doc: 'Compose a named object from in-scope values for binding to @template. Body lines are <key> = <expression> or ...<spread>. Dot-notation builds nested objects; later entries override earlier ones. (v1.2+)',
    kind: vscode.CompletionItemKind.Struct,
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
    label: '@template',
    snippet: '@template ${1:./partial.md} data=${2:data} /',
    doc: 'Inline a partial MarkdownAI document and bind it to a data context. Inside the partial, the bound value is accessible as {{ data.* }} (or {{ <name>.* }} with as=<name>). Reads inherit from caller; writes are sandboxed. (v1.2+)',
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
    label: '@event',
    snippet: "@event name='${1:event-name}' data='${2:value-or-json}' transport='${3|log,mcp,vscode,file,http,db,websocket|}'",
    doc: 'Fire a named event to one or more transports — data can be a plain string or a JSON object string',
    kind: vscode.CompletionItemKind.Event,
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
  {
    label: '@set',
    snippet: '@set ${1:name} = ${2:value}',
    doc: 'Bind a value to a name. RHS can be a literal, a directive, or an interpolated string. (v1.0+)',
    kind: vscode.CompletionItemKind.Variable,
  },
  {
    label: '@read-frontmatter',
    snippet: '@read-frontmatter path="${1:./doc.md}" field="${2:status}" label=${3:value}',
    doc: 'Read a single YAML field from a doc\'s frontmatter. Returns empty string if missing. (v1.0+)',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@hash',
    snippet: '@hash path="${1:./doc.md}" algo=${2|sha256,sha1,md5|} length=${3:8} label=${4:hash}',
    doc: 'Compute a content hash. Optional exclude-line=regex strips matching lines first. (v1.0+)',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@test',
    snippet: '@test command="${1:pnpm test}" label=${2:results}',
    doc: 'Run the project test suite. Inlines full output; exposes label, label_exit, label_summary. (v1.0+)',
    kind: vscode.CompletionItemKind.Interface,
  },
  {
    label: '@check',
    snippet: '@check command="${1:tsc --noEmit}" label=${2:typecheck}',
    doc: 'Run typecheck / lint / build. Auto-detects from package.json scripts when command= is omitted. (v1.0+)',
    kind: vscode.CompletionItemKind.Interface,
  },
  {
    label: '@mkdir',
    snippet: '@mkdir ${1:.mdd/docs}',
    doc: 'Create a directory. Recursive by default. Requires filesystem.write_enabled. (v1.0+)',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@copy',
    snippet: '@copy from="${1:./template.md}" to="${2:./.mdd/file.md}" if-missing',
    doc: 'Copy a file. if-missing makes it idempotent. Requires filesystem.write_enabled. (v1.0+)',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@append-if-missing',
    snippet: '@append-if-missing path="${1:.gitignore}" text="${2:.mdd/audits/}"',
    doc: 'Append a line only if not already present. Requires filesystem.write_enabled. (v1.0+)',
    kind: vscode.CompletionItemKind.Operator,
  },
  {
    label: '@update-frontmatter',
    snippet: '@update-frontmatter path="${1:./doc.md}" field="${2:status}" value="${3:complete}"',
    doc: 'Set a YAML frontmatter field. Supports field[append], field[N], nested field[N].sub. Requires filesystem.write_enabled. (v1.0+)',
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
