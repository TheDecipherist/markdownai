import * as vscode from 'vscode';
import { extractCallTarget, formatHoverMarkdown } from './macro-registry.js';
import type { MacroRegistry } from './completion-provider.js';

export function registerHoverProvider(
  context: vscode.ExtensionContext,
  registry: MacroRegistry,
): vscode.Disposable {
  const provider = vscode.languages.registerHoverProvider(
    { language: 'markdownai' },
    {
      provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
      ): vscode.Hover | undefined {
        const line = document.lineAt(position).text;
        const macroName = extractCallTarget(line, position.character);
        if (!macroName) return undefined;

        const macro = registry.getMacros(document).find(m => m.name === macroName);
        if (!macro) return undefined;

        const content = new vscode.MarkdownString(formatHoverMarkdown(macro));
        return new vscode.Hover(content);
      },
    },
  );

  context.subscriptions.push(provider);
  return provider;
}
