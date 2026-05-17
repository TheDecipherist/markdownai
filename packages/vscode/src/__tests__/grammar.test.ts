import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const grammarPath = join(__dirname, '../../syntaxes/markdownai.tmLanguage.json');

describe('MarkdownAI TextMate Grammar', () => {
  let grammar: Record<string, unknown>;

  it('should be valid JSON', () => {
    const raw = readFileSync(grammarPath, 'utf8');
    expect(() => { grammar = JSON.parse(raw) as Record<string, unknown>; }).not.toThrow();
  });

  it('should have scopeName text.markdownai', () => {
    const raw = JSON.parse(readFileSync(grammarPath, 'utf8')) as Record<string, unknown>;
    expect(raw['scopeName']).toBe('text.markdownai');
  });

  it('should include a header pattern for @markdownai', () => {
    const raw = JSON.parse(readFileSync(grammarPath, 'utf8')) as Record<string, unknown>;
    const repo = raw['repository'] as Record<string, unknown>;
    expect(repo).toHaveProperty('header');
    const header = repo['header'] as Record<string, unknown>;
    expect(String(header['match'])).toContain('@markdownai');
  });

  it('should include a directive-line pattern with all core directives', () => {
    const raw = JSON.parse(readFileSync(grammarPath, 'utf8')) as Record<string, unknown>;
    const repo = raw['repository'] as Record<string, unknown>;
    expect(repo).toHaveProperty('directive-line');
    const line = repo['directive-line'] as Record<string, unknown>;
    const begin = String(line['begin']);
    expect(begin).toContain('import');
    expect(begin).toContain('define');
    expect(begin).toContain('if');
    expect(begin).toContain('query');
  });

  it('should include an interpolation pattern for {{ }}', () => {
    const raw = JSON.parse(readFileSync(grammarPath, 'utf8')) as Record<string, unknown>;
    const repo = raw['repository'] as Record<string, unknown>;
    expect(repo).toHaveProperty('interpolation');
    const interp = repo['interpolation'] as Record<string, unknown>;
    expect(String(interp['begin'])).toContain('{');
    expect(String(interp['end'])).toContain('}');
  });

  it('should delegate to text.html.markdown for prose', () => {
    const raw = JSON.parse(readFileSync(grammarPath, 'utf8')) as Record<string, unknown>;
    const patterns = raw['patterns'] as Array<Record<string, unknown>>;
    const includes = patterns.map(p => p['include']);
    expect(includes).toContain('text.html.markdown');
  });
});
