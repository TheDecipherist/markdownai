import * as vscode from 'vscode';
import { extractCallTarget } from './macro-registry.js';
import type { MacroRegistry } from './completion-provider.js';

export function registerDefinitionProvider(
  context: vscode.ExtensionContext,
  registry: MacroRegistry,
): vscode.Disposable {
  const provider = vscode.languages.registerDefinitionProvider(
    { language: 'markdownai' },
    {
      provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
      ): vscode.Location | undefined {
        const line = document.lineAt(position).text;
        const macroName = extractCallTarget(line, position.character);
        if (!macroName) return undefined;

        const macro = registry.getMacros(document).find(m => m.name === macroName);
        if (!macro?.filePath) return undefined;

        const targetUri = vscode.Uri.file(macro.filePath);
        const targetLine = macro.definitionLine ?? 0;
        const targetPosition = new vscode.Position(targetLine, 0);
        return new vscode.Location(targetUri, targetPosition);
      },
    },
  );

  context.subscriptions.push(provider);
  return provider;
}
