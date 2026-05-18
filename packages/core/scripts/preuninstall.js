#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SECTION_START_MARKER = '<!-- markdownai-claude-integration -->';
const SECTION_END_MARKER = '<!-- /markdownai-claude-integration -->';

const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md');

if (!existsSync(claudeMdPath)) {
  process.exit(0);
}

const content = readFileSync(claudeMdPath, 'utf8');

const startIdx = content.indexOf(SECTION_START_MARKER);
if (startIdx === -1) {
  process.exit(0);
}

const endIdx = content.indexOf(SECTION_END_MARKER, startIdx);
if (endIdx === -1) {
  console.error('WARN: MarkdownAI section end marker not found in ~/.claude/CLAUDE.md — skipping removal to avoid data loss. Remove the section manually.');
  process.exit(0);
}
const blockEnd = endIdx + SECTION_END_MARKER.length;

const before = content.slice(0, startIdx).replace(/\n+$/, '');
const after = content.slice(blockEnd).replace(/^\n+/, '');

let result;
if (!before && !after) {
  result = '';
} else if (!before) {
  result = after;
} else if (!after) {
  result = before;
} else {
  result = before + '\n\n' + after;
}

if (result.trim() === '') {
  unlinkSync(claudeMdPath);
} else {
  writeFileSync(claudeMdPath, result, 'utf8');
}

console.log('✓ MarkdownAI instructions removed from ~/.claude/CLAUDE.md');
