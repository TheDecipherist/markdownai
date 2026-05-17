import { describe, it, expect } from 'vitest';
import { shouldSwitchToMarkdownAI } from '../language-detection';

describe('Language Detection', () => {
  describe('shouldSwitchToMarkdownAI', () => {
    it('should return true for markdown doc with @markdownai on line 1', () => {
      expect(shouldSwitchToMarkdownAI('markdown', '@markdownai')).toBe(true);
    });

    it('should return true when line has trailing whitespace', () => {
      expect(shouldSwitchToMarkdownAI('markdown', '@markdownai  ')).toBe(true);
    });

    it('should return false when already markdownai language', () => {
      expect(shouldSwitchToMarkdownAI('markdownai', '@markdownai')).toBe(false);
    });

    it('should return false when first line does not match', () => {
      expect(shouldSwitchToMarkdownAI('markdown', '# My Doc')).toBe(false);
    });

    it('should return false when first line is empty', () => {
      expect(shouldSwitchToMarkdownAI('markdown', '')).toBe(false);
    });

    it('should return false for non-markdown files', () => {
      expect(shouldSwitchToMarkdownAI('typescript', '@markdownai')).toBe(false);
    });

    it('should be case-sensitive — @Markdownai does not match', () => {
      expect(shouldSwitchToMarkdownAI('markdown', '@Markdownai')).toBe(false);
    });

    it('should return true when @markdownai follows YAML frontmatter', () => {
      const text = '---\ntitle: My Doc\nauthor: Tim\n---\n@markdownai\n';
      expect(shouldSwitchToMarkdownAI('markdown', text)).toBe(true);
    });

    it('should return true when @markdownai follows frontmatter closed with ...', () => {
      const text = '---\ntitle: My Doc\n...\n@markdownai\n';
      expect(shouldSwitchToMarkdownAI('markdown', text)).toBe(true);
    });

    it('should return true when a blank line separates frontmatter and @markdownai', () => {
      const text = '---\ntitle: My Doc\n---\n\n@markdownai\n';
      expect(shouldSwitchToMarkdownAI('markdown', text)).toBe(true);
    });

    it('should return false when @markdownai is absent after frontmatter', () => {
      const text = '---\ntitle: My Doc\n---\n# Just a normal doc\n';
      expect(shouldSwitchToMarkdownAI('markdown', text)).toBe(false);
    });

    it('should return false for plain markdown with frontmatter and no @markdownai', () => {
      const text = '---\ntitle: Blog Post\n---\n\nSome prose.\n';
      expect(shouldSwitchToMarkdownAI('markdown', text)).toBe(false);
    });
  });
});
