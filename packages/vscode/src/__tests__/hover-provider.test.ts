import { describe, it, expect } from 'vitest';
import { extractCallTarget, formatHoverMarkdown } from '../providers/macro-registry.js';
import type { MacroInfo } from '../providers/macro-registry.js';

const STDLIB_MACRO: MacroInfo = {
  name: 'git-status',
  label: 'git_status',
  description: 'Compact view: M=modified, A=added, D=deleted.',
  source: 'stdlib',
};

const LOCAL_MACRO: MacroInfo = {
  name: 'my-summary',
  label: 'summary',
  description: '',
  source: 'local',
  filePath: 'file:///project/test.md',
  definitionLine: 3,
};

const NO_LABEL_MACRO: MacroInfo = {
  name: 'side-effect',
  label: '',
  description: 'Runs a side-effect command.',
  source: 'local',
};

describe('extractCallTarget', () => {
  it('should extract macro name from @call line when cursor is on the name', () => {
    expect(extractCallTarget('@call git-status', 8)).toBe('git-status');
  });

  it('should extract macro name when cursor is at any position on the @call line', () => {
    expect(extractCallTarget('@call git-status', 0)).toBe('git-status');
    expect(extractCallTarget('@call git-status', 16)).toBe('git-status');
  });

  it('should extract macro name from @define line', () => {
    expect(extractCallTarget('@define my-macro', 8)).toBe('my-macro');
  });

  it('should return null for a plain prose line', () => {
    expect(extractCallTarget('Some prose here.', 4)).toBeNull();
  });

  it('should return null for empty line', () => {
    expect(extractCallTarget('', 0)).toBeNull();
  });

  it('should return null when @call has no macro name yet', () => {
    expect(extractCallTarget('@call ', 6)).toBeNull();
  });
});

describe('formatHoverMarkdown', () => {
  it('should include macro name and source badge', () => {
    const md = formatHoverMarkdown(STDLIB_MACRO);
    expect(md).toContain('git-status');
    expect(md).toContain('stdlib');
  });

  it('should include "→ sets" line when label is present', () => {
    const md = formatHoverMarkdown(STDLIB_MACRO);
    expect(md).toContain('git_status');
    expect(md).toContain('→');
  });

  it('should omit "→ sets" line when label is empty', () => {
    const md = formatHoverMarkdown(NO_LABEL_MACRO);
    expect(md).not.toContain('→ sets');
  });

  it('should include description when present', () => {
    const md = formatHoverMarkdown(STDLIB_MACRO);
    expect(md).toContain('Compact view');
  });

  it('should omit description paragraph when description is empty', () => {
    const md = formatHoverMarkdown(LOCAL_MACRO);
    expect(md).not.toContain('\n\n\n');
  });

  it('should show "local" source for local macros', () => {
    const md = formatHoverMarkdown(LOCAL_MACRO);
    expect(md).toContain('local');
  });
});
