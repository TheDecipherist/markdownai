import { describe, it, expect } from 'vitest';
import { readSettings } from '../settings.js';
import type { MarkdownAISettings } from '../settings.js';

type FakeConfig = Partial<MarkdownAISettings & { 'diagnostics.enabled': boolean; 'diagnostics.warnUndefinedMacros': boolean; stdlibPath: string }>;

function makeGetter(overrides: FakeConfig = {}) {
  return (key: string): unknown => {
    if (key in overrides) return (overrides as Record<string, unknown>)[key];
    return undefined;
  };
}

describe('readSettings', () => {
  it('should return defaults when no configuration overrides are set', () => {
    const settings = readSettings(makeGetter());
    expect(settings.diagnosticsEnabled).toBe(true);
    expect(settings.warnUndefinedMacros).toBe(true);
    expect(settings.stdlibPath).toBe('packages/engine/src/stdlib.md');
  });

  it('should read diagnosticsEnabled from configuration', () => {
    const settings = readSettings(makeGetter({ 'diagnostics.enabled': false }));
    expect(settings.diagnosticsEnabled).toBe(false);
  });

  it('should read warnUndefinedMacros from configuration', () => {
    const settings = readSettings(makeGetter({ 'diagnostics.warnUndefinedMacros': false }));
    expect(settings.warnUndefinedMacros).toBe(false);
  });

  it('should read stdlibPath from configuration', () => {
    const settings = readSettings(makeGetter({ stdlibPath: 'custom/path/stdlib.md' }));
    expect(settings.stdlibPath).toBe('custom/path/stdlib.md');
  });

  it('should fall back to defaults for undefined keys', () => {
    const settings = readSettings(makeGetter({ 'diagnostics.enabled': true }));
    expect(settings.stdlibPath).toBe('packages/engine/src/stdlib.md');
    expect(settings.warnUndefinedMacros).toBe(true);
  });
});
