import { describe, it, expect } from 'vitest';
import { findCallSites } from '../providers/macro-registry.js';

const DOC = `@markdownai

@call git-status
Some prose.
@call git-branch
@call git-status
@define git-status
@query git status --short label=git_status
@end
`;

describe('findCallSites', () => {
  it('should find all @call occurrences of a macro name', () => {
    const sites = findCallSites(DOC, 'git-status', 'file:///test.md');
    expect(sites).toHaveLength(2);
  });

  it('should return correct line numbers for each call site', () => {
    const sites = findCallSites(DOC, 'git-status', 'file:///test.md');
    expect(sites[0]?.line).toBe(2);
    expect(sites[1]?.line).toBe(5);
  });

  it('should return correct character range for the macro name', () => {
    const sites = findCallSites(DOC, 'git-status', 'file:///test.md');
    // "@call git-status" → "@call " is 6 chars, "git-status" starts at 6
    expect(sites[0]?.startChar).toBe(6);
    expect(sites[0]?.endChar).toBe(16);
  });

  it('should return empty array when no @call uses the macro', () => {
    const sites = findCallSites(DOC, 'nonexistent-macro', 'file:///test.md');
    expect(sites).toHaveLength(0);
  });

  it('should not match @define lines as call sites', () => {
    const sites = findCallSites(DOC, 'git-status', 'file:///test.md');
    const lines = sites.map(s => s.line);
    expect(lines).not.toContain(6); // line 6 is @define git-status
  });

  it('should set filePath on each call site', () => {
    const sites = findCallSites(DOC, 'git-status', 'file:///test.md');
    expect(sites.every(s => s.filePath === 'file:///test.md')).toBe(true);
  });
});
