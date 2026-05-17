export function shouldSwitchToMarkdownAI(languageId: string, firstLine: string): boolean {
  return languageId === 'markdown' && firstLine.trim() === '@markdownai';
}
