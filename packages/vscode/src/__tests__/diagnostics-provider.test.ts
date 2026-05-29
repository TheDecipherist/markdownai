import { describe, it, expect } from 'vitest';
import { analyzeDiagnostics } from '../providers/diagnostics-engine.js';

const KNOWN_MACROS = ['git-status', 'git-branch', 'my-summary'];

describe('analyzeDiagnostics - structural errors', () => {
  describe('unclosed @if blocks', () => {
    it('should report error for @if without @if-end', () => {
      const text = `@markdownai\n@if {{ env_var }}\nSome content\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result).toHaveLength(1);
      expect(result[0]?.severity).toBe('error');
      expect(result[0]?.message).toContain('Unclosed @if');
      expect(result[0]?.line).toBe(1);
    });

    it('should not report error when @if is properly closed with @if-end', () => {
      const text = `@markdownai\n@if {{ env_var }}\nSome content\n@if-end\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result).toHaveLength(0);
    });

    it('should report error for nested @if missing inner @if-end', () => {
      const text = `@markdownai\n@if {{ a }}\n@if {{ b }}\ncontent\n@if-end\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result).toHaveLength(1);
      expect(result[0]?.message).toContain('Unclosed @if');
    });

    it('should report no error when nested @if blocks are all closed', () => {
      const text = `@markdownai\n@if {{ a }}\n@if {{ b }}\ncontent\n@if-end\n@if-end\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result).toHaveLength(0);
    });

    it('should track error on the opening @if line number', () => {
      const text = `@markdownai\nSome prose\n@if {{ env_var }}\ncontent\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result[0]?.line).toBe(2);
    });
  });

  describe('unclosed @define blocks', () => {
    it('should report error for @define without @define-end', () => {
      const text = `@markdownai\n@define my-macro\n@query git status label=out\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result).toHaveLength(1);
      expect(result[0]?.severity).toBe('error');
      expect(result[0]?.message).toContain('Unclosed @define');
    });

    it('should not report error when @define is properly closed with @define-end', () => {
      const text = `@markdownai\n@define my-macro\n@query git status label=out\n@define-end\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  describe('unclosed @phase blocks', () => {
    it('should report error for @phase without @phase-end', () => {
      const text = `@markdownai\n@phase setup\ncontent\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result).toHaveLength(1);
      expect(result[0]?.severity).toBe('error');
      expect(result[0]?.message).toContain('Unclosed @phase');
    });

    it('should not report error when @phase is properly closed with @phase-end', () => {
      const text = `@markdownai\n@phase setup\ncontent\n@phase-end\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result.filter(d => d.severity === 'error')).toHaveLength(0);
    });
  });

  describe('multiple errors', () => {
    it('should report all structural errors in a document, not just the first', () => {
      const text = `@markdownai\n@if {{ a }}\ncontent\n@define bad-macro\nbody\n`;
      const result = analyzeDiagnostics(text, KNOWN_MACROS);
      expect(result.filter(d => d.severity === 'error')).toHaveLength(2);
    });
  });
});

describe('analyzeDiagnostics - undefined macro warnings', () => {
  it('should report warning for @call to undefined macro', () => {
    const text = `@markdownai\n@call undefined-macro\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result).toHaveLength(1);
    expect(result[0]?.severity).toBe('warning');
    expect(result[0]?.message).toContain('undefined-macro');
  });

  it('should not report warning for @call to known stdlib macro', () => {
    const text = `@markdownai\n@call git-status\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result.filter(d => d.severity === 'warning')).toHaveLength(0);
  });

  it('should not report warning for @call to known local macro', () => {
    const text = `@markdownai\n@call my-summary\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result.filter(d => d.severity === 'warning')).toHaveLength(0);
  });

  it('should report warning on the @call line number', () => {
    const text = `@markdownai\nSome prose\n@call no-such-macro\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result[0]?.line).toBe(2);
  });

  it('should include the macro name in the warning range', () => {
    const text = `@markdownai\n@call no-such-macro\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result[0]?.startChar).toBe(6);
    expect(result[0]?.endChar).toBe(6 + 'no-such-macro'.length);
  });

  it('should report multiple warnings for multiple undefined @call references', () => {
    const text = `@markdownai\n@call foo\n@call bar\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result.filter(d => d.severity === 'warning')).toHaveLength(2);
  });
});

describe('analyzeDiagnostics - mixed errors and warnings', () => {
  it('should report both structural errors and undefined macro warnings together', () => {
    const text = `@markdownai\n@if {{ env }}\ncontent\n@call no-such-macro\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    const errors = result.filter(d => d.severity === 'error');
    const warnings = result.filter(d => d.severity === 'warning');
    expect(errors).toHaveLength(1);
    expect(warnings).toHaveLength(1);
  });

  it('should return empty array for a clean document', () => {
    const text = `@markdownai\n@if {{ env }}\ncontent\n@if-end\n@call git-status\n`;
    const result = analyzeDiagnostics(text, KNOWN_MACROS);
    expect(result).toHaveLength(0);
  });
});
