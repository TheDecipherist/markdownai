export interface DiagnosticInfo {
  line: number;
  startChar: number;
  endChar: number;
  message: string;
  severity: 'error' | 'warning';
}

interface OpenBlock {
  directive: string;
  line: number;
}

const IF_RE = /^@if\b/;
const ENDIF_RE = /^@endif\b/;
const ELSEIF_RE = /^@elseif\b/;
const ELSE_RE = /^@else\b/;
const DEFINE_RE = /^@define\b/;
const PHASE_RE = /^@phase\b/;
const END_RE = /^@end\b/;
const CALL_RE = /^@call\s+([\w-]+)/;

export function analyzeDiagnostics(text: string, knownMacroNames: string[] | Set<string>): DiagnosticInfo[] {
  const macroSet = knownMacroNames instanceof Set ? knownMacroNames : new Set(knownMacroNames)
  const diagnostics: DiagnosticInfo[] = [];
  const lines = text.split('\n');

  const ifStack: OpenBlock[] = [];
  const blockStack: OpenBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();

    if (IF_RE.test(trimmed)) {
      ifStack.push({ directive: 'if', line: i });
    } else if (ELSEIF_RE.test(trimmed) || ELSE_RE.test(trimmed)) {
      if (ifStack.length === 0) {
        diagnostics.push({
          line: i,
          startChar: 0,
          endChar: trimmed.length,
          message: `Stray ${trimmed.startsWith('@elseif') ? '@elseif' : '@else'} - no open @if block`,
          severity: 'error',
        });
      }
    } else if (ENDIF_RE.test(trimmed)) {
      if (ifStack.length === 0) {
        diagnostics.push({
          line: i,
          startChar: 0,
          endChar: trimmed.length,
          message: '@endif with no matching @if',
          severity: 'error',
        });
      } else {
        ifStack.pop();
      }
    } else if (DEFINE_RE.test(trimmed)) {
      blockStack.push({ directive: 'define', line: i });
    } else if (PHASE_RE.test(trimmed)) {
      blockStack.push({ directive: 'phase', line: i });
    } else if (END_RE.test(trimmed)) {
      if (blockStack.length === 0) {
        diagnostics.push({
          line: i,
          startChar: 0,
          endChar: trimmed.length,
          message: '@end with no matching @define or @phase',
          severity: 'error',
        });
      } else {
        blockStack.pop();
      }
    } else {
      const callMatch = trimmed.match(CALL_RE);
      if (callMatch) {
        const macroName = callMatch[1] ?? '';
        if (!macroSet.has(macroName)) {
          const startChar = '@call '.length;
          diagnostics.push({
            line: i,
            startChar,
            endChar: startChar + macroName.length,
            message: `Undefined macro: "${macroName}" is not defined in this document or stdlib`,
            severity: 'warning',
          });
        }
      }
    }
  }

  for (const block of ifStack) {
    const lineText = lines[block.line] ?? '';
    diagnostics.push({
      line: block.line,
      startChar: 0,
      endChar: lineText.length,
      message: 'Unclosed @if block - missing @endif',
      severity: 'error',
    });
  }

  for (const block of blockStack) {
    const lineText = lines[block.line] ?? '';
    diagnostics.push({
      line: block.line,
      startChar: 0,
      endChar: lineText.length,
      message: `Unclosed @${block.directive} block - missing @end`,
      severity: 'error',
    });
  }

  return diagnostics;
}
