import * as vscode from 'vscode';
import { extractCallTarget, findCallSites } from './macro-registry.js';
import type { MacroRegistry } from './completion-provider.js';

function findDefinitionLocation(macroName: string, registry: MacroRegistry, document: vscode.TextDocument): vscode.Location | null {
  const localMacro = registry
    .getMacros(document)
    .find(m => m.name === macroName && m.source === 'local');
  if (!localMacro?.filePath || localMacro.definitionLine === undefined) return null;
  const defStart = '@define '.length;
  return new vscode.Location(
    vscode.Uri.file(localMacro.filePath),
    new vscode.Range(
      new vscode.Position(localMacro.definitionLine, defStart),
      new vscode.Position(localMacro.definitionLine, defStart + macroName.length),
    ),
  );
}

export function registerReferenceProvider(
  context: vscode.ExtensionContext,
  registry: MacroRegistry,
): vscode.Disposable {
  const provider = vscode.languages.registerReferenceProvider(
    { language: 'markdownai' },
    {
      provideReferences(document: vscode.TextDocument, position: vscode.Position): vscode.Location[] {
        const macroName = extractCallTarget(document.lineAt(position).text, position.character);
        if (!macroName) return [];

        const locations = findCallSites(document.getText(), macroName, document.uri.fsPath).map(site =>
          new vscode.Location(
            vscode.Uri.file(site.filePath),
            new vscode.Range(new vscode.Position(site.line, site.startChar), new vscode.Position(site.line, site.endChar)),
          )
        );

        const defLoc = findDefinitionLocation(macroName, registry, document);
        if (defLoc) locations.push(defLoc);
        return locations;
      },
    },
  );

  context.subscriptions.push(provider);
  return provider;
}
