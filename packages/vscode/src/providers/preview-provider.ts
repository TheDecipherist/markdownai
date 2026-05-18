import * as vscode from 'vscode';
import { execFile } from 'child_process';

export const PREVIEW_SCHEME = 'markdownai-preview';

export class PreviewProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): Thenable<string> {
    const filePath = uri.with({ scheme: 'file' }).fsPath;
    return new Promise(resolve => {
      execFile('mai', ['render', filePath], { timeout: 15000 }, (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message).trim();
          resolve(`# MarkdownAI Preview — Render Error\n\n\`\`\`\n${msg}\n\`\`\`\n\n> Save the file and try again, or run \`mai render\` in the terminal for details.`);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  refresh(uri: vscode.Uri): void {
    this._onDidChange.fire(uri);
  }
}

export function toPreviewUri(fileUri: vscode.Uri): vscode.Uri {
  return fileUri.with({ scheme: PREVIEW_SCHEME });
}
