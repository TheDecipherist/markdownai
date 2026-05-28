export interface MacroInfo {
  name: string;
  label: string;
  description: string;
  source: 'stdlib' | 'local' | 'imported';
  filePath?: string;
  definitionLine?: number;
}

// Matches: <!-- macro-name → label_var ... -->
const FIRST_COMMENT_RE = /^<!--\s+([\w-]+)\s+→\s+([\w_]+)/;
// Matches any comment line and captures inner text
const COMMENT_RE = /^<!--\s*(.*?)\s*-->\s*$/;
// Skip Usage lines
const USAGE_RE = /^Usage:/i;
// Matches @define macro-name
const DEFINE_RE = /^@define\s+([\w-]+)/;
// Matches label=varname inside a directive line
const LABEL_RE = /\blabel=([\w_]+)/;

export function parseStdlibMacros(content: string): MacroInfo[] {
  if (!content) return [];

  const macros: MacroInfo[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const firstMatch = line.match(FIRST_COMMENT_RE);
    if (!firstMatch) {
      i++;
      continue;
    }

    const name = firstMatch[1] ?? '';
    const label = firstMatch[2] ?? '';
    const descLines: string[] = [];
    let j = i + 1;

    while (j < lines.length) {
      const jLine = lines[j] ?? '';
      const commentMatch = jLine.match(COMMENT_RE);
      if (!commentMatch) break;
      const text = (commentMatch[1] ?? '').trim();
      if (text && !USAGE_RE.test(text)) {
        descLines.push(text);
      }
      j++;
    }

    const jLine = lines[j] ?? '';
    if (DEFINE_RE.test(jLine)) {
      macros.push({
        name,
        label,
        description: descLines.join(' '),
        source: 'stdlib',
        definitionLine: j,
      });
    }

    i = j;
  }

  return macros;
}

export function scanDocumentMacros(text: string, filePath: string): MacroInfo[] {
  const macros: MacroInfo[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const defineMatch = line.match(DEFINE_RE);
    if (!defineMatch) continue;

    const name = defineMatch[1] ?? '';
    let label = '';

    for (let j = i + 1; j < lines.length; j++) {
      const jLine = lines[j] ?? '';
      if (jLine.trim() === '@define-end') break;
      const labelMatch = jLine.match(LABEL_RE);
      if (labelMatch) {
        label = labelMatch[1] ?? '';
        break;
      }
    }

    macros.push({
      name,
      label,
      description: '',
      source: 'local',
      filePath,
      definitionLine: i,
    });
  }

  return macros;
}

export function isCompletionContext(lineText: string, cursorChar: number): boolean {
  const textBefore = lineText.slice(0, cursorChar);
  return /^@call\s+\S*$/.test(textBefore);
}

export interface CallSite {
  filePath: string;
  line: number;
  startChar: number;
  endChar: number;
}

const CALL_OR_DEFINE_RE = /^@(?:call|define)\s+([\w-]+)/;
const CALL_ONLY_RE = /^@call\s+([\w-]+)/;

export function extractCallTarget(lineText: string, _cursorChar: number): string | null {
  const match = lineText.match(CALL_OR_DEFINE_RE);
  return match ? (match[1] ?? null) : null;
}

export function findCallSites(text: string, macroName: string, filePath: string): CallSite[] {
  const sites: CallSite[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = line.match(CALL_ONLY_RE);
    if (!match) continue;
    if ((match[1] ?? '') !== macroName) continue;

    // "@call " prefix length before the macro name
    const prefix = '@call ';
    const startChar = prefix.length;
    const endChar = startChar + macroName.length;
    sites.push({ filePath, line: i, startChar, endChar });
  }

  return sites;
}

export function formatHoverMarkdown(macro: MacroInfo): string {
  const parts: string[] = [];
  parts.push(`**${macro.name}** _(${macro.source})_`);
  if (macro.label) {
    parts.push(`→ sets \`{{ ${macro.label} }}\``);
  }
  if (macro.description) {
    parts.push('');
    parts.push(macro.description);
  }
  return parts.join('\n\n');
}
