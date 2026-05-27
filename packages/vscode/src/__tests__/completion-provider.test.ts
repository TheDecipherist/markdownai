import { describe, it, expect } from 'vitest';
import { parseStdlibMacros, scanDocumentMacros, isCompletionContext } from '../providers/macro-registry.js';

const STDLIB_SAMPLE = `@markdownai

<!-- git-status → git_status                                                      -->
<!-- Compact view: M=modified, A=added, D=deleted.                               -->
<!-- Usage:  @call git-status  →  {{ git_status }}                               -->
@define git-status
@query git status --short label=git_status /
@define-end

<!-- git-branch → current_branch                                                  -->
<!-- Name of the currently checked-out branch.                                   -->
<!-- Usage:  @call git-branch  →  {{ current_branch }}                           -->
@define git-branch
@query git branch --show-current label=current_branch /
@define-end
`;

const DOC_WITH_DEFINES = `@markdownai

@define my-summary
@query cat README.md label=summary /
@define-end

@define project-status
@query git status --short label=project_status /
@define-end

Some prose here.
`;

describe('parseStdlibMacros', () => {
  it('should parse macro name and label from arrow notation', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    expect(macros).toHaveLength(2);
    expect(macros[0]?.name).toBe('git-status');
    expect(macros[0]?.label).toBe('git_status');
    expect(macros[1]?.name).toBe('git-branch');
    expect(macros[1]?.label).toBe('current_branch');
  });

  it('should include description lines (excluding Usage line)', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    expect(macros[0]?.description).toContain('Compact view');
    expect(macros[0]?.description).not.toContain('Usage:');
  });

  it('should return empty array for empty input', () => {
    const macros = parseStdlibMacros('');
    expect(macros).toHaveLength(0);
  });

  it('should set source as "stdlib" for all parsed macros', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    expect(macros.every(m => m.source === 'stdlib')).toBe(true);
  });

  it('should trim whitespace padding from label', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    expect(macros[0]?.label).toBe('git_status');
    expect(macros[0]?.label).not.toMatch(/\s/);
  });
});

describe('scanDocumentMacros', () => {
  it('should extract @define names from document text', () => {
    const macros = scanDocumentMacros(DOC_WITH_DEFINES, 'file:///test.md');
    expect(macros).toHaveLength(2);
    expect(macros[0]?.name).toBe('my-summary');
    expect(macros[1]?.name).toBe('project-status');
  });

  it('should set source as "local" for document-level macros', () => {
    const macros = scanDocumentMacros(DOC_WITH_DEFINES, 'file:///test.md');
    expect(macros.every(m => m.source === 'local')).toBe(true);
  });

  it('should record definition line number for each macro', () => {
    const macros = scanDocumentMacros(DOC_WITH_DEFINES, 'file:///test.md');
    expect(macros[0]?.definitionLine).toBe(2);
    expect(macros[1]?.definitionLine).toBe(6);
  });

  it('should return empty array when no @define blocks exist', () => {
    const macros = scanDocumentMacros('@markdownai\n\nSome prose.', 'file:///test.md');
    expect(macros).toHaveLength(0);
  });

  it('should not include label if no label= arg is present on @query line', () => {
    const macros = scanDocumentMacros('@markdownai\n@define no-label\n@query echo hi\n@end', 'file:///test.md');
    expect(macros).toHaveLength(1);
    expect(macros[0]?.label).toBe('');
  });
});

describe('isCompletionContext', () => {
  it('should return true when line is exactly "@call " (cursor after space)', () => {
    expect(isCompletionContext('@call ', 6)).toBe(true);
  });

  it('should return true when line has "@call " followed by a partial macro name', () => {
    expect(isCompletionContext('@call git-', 10)).toBe(true);
  });

  it('should return false when cursor is not after @call', () => {
    expect(isCompletionContext('Some prose @call', 16)).toBe(false);
  });

  it('should return false for @define lines', () => {
    expect(isCompletionContext('@define ', 8)).toBe(false);
  });

  it('should return false for empty line', () => {
    expect(isCompletionContext('', 0)).toBe(false);
  });
});
