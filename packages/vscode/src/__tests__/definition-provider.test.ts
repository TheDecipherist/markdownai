import { describe, it, expect } from 'vitest';
import { parseStdlibMacros } from '../providers/macro-registry.js';

const STDLIB_SAMPLE = `@markdownai

<!-- git-status → git_status                                                      -->
<!-- Compact view: M=modified, A=added, D=deleted.                               -->
<!-- Usage:  @call git-status  →  {{ git_status }}                               -->
@define git-status
@query git status --short label=git_status
@end

<!-- git-branch → current_branch                                                  -->
<!-- Name of the currently checked-out branch.                                   -->
<!-- Usage:  @call git-branch  →  {{ current_branch }}                           -->
@define git-branch
@query git branch --show-current label=current_branch
@end
`;

describe('parseStdlibMacros - definition line tracking', () => {
  it('should store definitionLine for each stdlib macro', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    expect(macros[0]?.definitionLine).toBeDefined();
    expect(macros[1]?.definitionLine).toBeDefined();
  });

  it('should record the 0-indexed line of @define for stdlib macros', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    // Line 0: @markdownai
    // Line 1: (empty)
    // Line 2: <!-- git-status → git_status ... -->
    // Line 3: <!-- Compact view -->
    // Line 4: <!-- Usage -->
    // Line 5: @define git-status
    expect(macros[0]?.definitionLine).toBe(5);
    // Line 9: (empty after @end)
    // Line 10: <!-- git-branch → current_branch ... -->
    // Line 11: <!-- Name of the ... -->
    // Line 12: <!-- Usage -->
    // Line 12: @define git-branch
    expect(macros[1]?.definitionLine).toBe(12);
  });

  it('should not overwrite filePath set by the registry - definitionLine is set but filePath is undefined from parser', () => {
    const macros = parseStdlibMacros(STDLIB_SAMPLE);
    // Parser sets definitionLine but NOT filePath (the registry sets filePath after parsing)
    expect(macros[0]?.filePath).toBeUndefined();
  });
});
