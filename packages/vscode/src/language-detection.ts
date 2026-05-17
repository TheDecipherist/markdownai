export function shouldSwitchToMarkdownAI(languageId: string, text: string): boolean {
  if (languageId !== 'markdown') return false;
  const lines = text.split('\n');
  let i = 0;

  // Skip YAML frontmatter (--- ... ---)
  if ((lines[0] ?? '').trim() === '---') {
    i = 1;
    while (i < lines.length) {
      const t = (lines[i] ?? '').trim();
      i++;
      if (t === '---' || t === '...') break;
    }
  }

  // Skip blank lines after frontmatter
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++;

  return (lines[i] ?? '').trim() === '@markdownai';
}
