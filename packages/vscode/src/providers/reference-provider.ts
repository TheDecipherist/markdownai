import * as vscode from 'vscode';
import { extractCallTarget, findCallSites } from './macro-registry.js';
import type { MacroRegistry } from './completion-provider.js';

export function registerReferenceProvider(
  context: vscode.ExtensionContext,
  registry: MacroRegistry,
): vscode.Disposable {
  const provider = vscode.languages.registerReferenceProvider(
    { language: 'markdownai' },
    {
      provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
      ): vscode.Location[] {
        const line = document.lineAt(position).text;
        const macroName = extractCallTarget(line, position.character);
        if (!macroName) return [];

        const filePath = document.uri.toString();
        const text = document.getText();
        const callSites = findCallSites(text, macroName, filePath);

        const locations = callSites.map(site => {
          const siteUri = vscode.Uri.parse(site.filePath);
          const range = new vscode.Range(
            new vscode.Position(site.line, site.startChar),
            new vscode.Position(site.line, site.endChar),
          );
          return new vscode.Location(siteUri, range);
        });

        // Also include the @define location for local macros
        const localMacro = registry
          .getMacros(document)
          .find(m => m.name === macroName && m.source === 'local');
        if (localMacro?.filePath && localMacro.definitionLine !== undefined) {
          const defUri = vscode.Uri.parse(localMacro.filePath);
          const defLine = localMacro.definitionLine;
          const defStart = '@define '.length;
          const defEnd = defStart + macroName.length;
          locations.push(
            new vscode.Location(
              defUri,
              new vscode.Range(
                new vscode.Position(defLine, defStart),
                new vscode.Position(defLine, defEnd),
              ),
            ),
          );
        }

        return locations;
      },
    },
  );

  context.subscriptions.push(provider);
  return provider;
}
