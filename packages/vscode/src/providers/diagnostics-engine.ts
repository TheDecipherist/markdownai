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

function checkCallReference(
  trimmed: string, lineNum: number, macroSet: Set<string>, diagnostics: DiagnosticInfo[]
): void {
  const callMatch = trimmed.match(CALL_RE);
  if (!callMatch) return;
  const macroName = callMatch[1] ?? '';
  if (!macroSet.has(macroName)) {
    const startChar = '@call '.length;
    diagnostics.push({
      line: lineNum, startChar, endChar: startChar + macroName.length,
      message: `Undefined macro: "${macroName}" is not defined in this document or stdlib`,
      severity: 'warning',
    });
  }
}

function processLine(
  trimmed: string, lineNum: number,
  ifStack: OpenBlock[], blockStack: OpenBlock[],
  macroSet: Set<string>, diagnostics: DiagnosticInfo[]
): void {
  if (IF_RE.test(trimmed)) {
    ifStack.push({ directive: 'if', line: lineNum });
  } else if (ELSEIF_RE.test(trimmed) || ELSE_RE.test(trimmed)) {
    if (ifStack.length === 0) {
      diagnostics.push({
        line: lineNum, startChar: 0, endChar: trimmed.length,
        message: `Stray ${trimmed.startsWith('@elseif') ? '@elseif' : '@else'} - no open @if block`,
        severity: 'error',
      });
    }
  } else if (ENDIF_RE.test(trimmed)) {
    if (ifStack.length === 0) {
      diagnostics.push({ line: lineNum, startChar: 0, endChar: trimmed.length, message: '@endif with no matching @if', severity: 'error' });
    } else {
      ifStack.pop();
    }
  } else if (DEFINE_RE.test(trimmed)) {
    blockStack.push({ directive: 'define', line: lineNum });
  } else if (PHASE_RE.test(trimmed)) {
    blockStack.push({ directive: 'phase', line: lineNum });
  } else if (END_RE.test(trimmed)) {
    if (blockStack.length === 0) {
      diagnostics.push({ line: lineNum, startChar: 0, endChar: trimmed.length, message: '@end with no matching @define or @phase', severity: 'error' });
    } else {
      blockStack.pop();
    }
  } else {
    checkCallReference(trimmed, lineNum, macroSet, diagnostics);
  }
}

function reportUnclosed(
  ifStack: OpenBlock[], blockStack: OpenBlock[], lines: string[], diagnostics: DiagnosticInfo[]
): void {
  for (const block of ifStack) {
    diagnostics.push({
      line: block.line, startChar: 0, endChar: (lines[block.line] ?? '').length,
      message: 'Unclosed @if block - missing @endif', severity: 'error',
    });
  }
  for (const block of blockStack) {
    diagnostics.push({
      line: block.line, startChar: 0, endChar: (lines[block.line] ?? '').length,
      message: `Unclosed @${block.directive} block - missing @end`, severity: 'error',
    });
  }
}

export function analyzeDiagnostics(text: string, knownMacroNames: string[] | Set<string>): DiagnosticInfo[] {
  const macroSet = knownMacroNames instanceof Set ? knownMacroNames : new Set(knownMacroNames);
  const diagnostics: DiagnosticInfo[] = [];
  const lines = text.split('\n');
  const ifStack: OpenBlock[] = [];
  const blockStack: OpenBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    processLine((lines[i] ?? '').trim(), i, ifStack, blockStack, macroSet, diagnostics);
  }
  reportUnclosed(ifStack, blockStack, lines, diagnostics);
  return diagnostics;
}
