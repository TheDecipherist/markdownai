import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const snippetsPath = join(__dirname, '../../snippets/markdownai.code-snippets');

type Snippet = {
  prefix: string;
  body: string[];
  description: string;
};

type SnippetsFile = Record<string, Snippet>;

describe('MarkdownAI Snippets', () => {
  it('should be valid JSON', () => {
    const raw = readFileSync(snippetsPath, 'utf8');
    expect(() => { JSON.parse(raw); }).not.toThrow();
  });

  it('should include a snippet for the @markdownai header', () => {
    const s = JSON.parse(readFileSync(snippetsPath, 'utf8')) as SnippetsFile;
    const headers = Object.values(s).filter(v => v.body.join('\n').includes('@markdownai'));
    expect(headers.length).toBeGreaterThan(0);
  });

  it('should include snippets for @define and @end', () => {
    const s = JSON.parse(readFileSync(snippetsPath, 'utf8')) as SnippetsFile;
    const body = Object.values(s).map(v => v.body.join('\n')).join('\n');
    expect(body).toContain('@define');
    expect(body).toContain('@end');
  });

  it('should include a snippet for @if / @endif', () => {
    const s = JSON.parse(readFileSync(snippetsPath, 'utf8')) as SnippetsFile;
    const body = Object.values(s).map(v => v.body.join('\n')).join('\n');
    expect(body).toContain('@if');
    expect(body).toContain('@endif');
  });

  it('should include a snippet for {{ interpolation }}', () => {
    const s = JSON.parse(readFileSync(snippetsPath, 'utf8')) as SnippetsFile;
    const prefixes = Object.values(s).map(v => v.prefix);
    expect(prefixes).toContain('{{');
  });

  it('should have descriptions on every snippet', () => {
    const s = JSON.parse(readFileSync(snippetsPath, 'utf8')) as SnippetsFile;
    for (const [name, snippet] of Object.entries(s)) {
      expect(snippet.description, `${name} is missing a description`).toBeTruthy();
    }
  });

  it('should include at least 15 snippets covering core directives', () => {
    const s = JSON.parse(readFileSync(snippetsPath, 'utf8')) as SnippetsFile;
    expect(Object.keys(s).length).toBeGreaterThanOrEqual(15);
  });
});
