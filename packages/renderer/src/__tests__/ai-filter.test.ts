import { describe, it, expect } from 'vitest'
import { aiFilter } from '../ai-filter.js'

describe('aiFilter — horizontal rule stripping', () => {
  it('strips --- rules', () => {
    expect(aiFilter('before\n---\nafter')).toBe('before\nafter')
  })

  it('strips *** rules', () => {
    expect(aiFilter('before\n***\nafter')).toBe('before\nafter')
  })

  it('strips ___ rules', () => {
    expect(aiFilter('before\n___\nafter')).toBe('before\nafter')
  })

  it('strips longer ---+ sequences (any run of 3+ dashes)', () => {
    expect(aiFilter('before\n------\nafter')).toBe('before\nafter')
  })

  it('does not strip ---- inside a code block context (inline dashes in prose)', () => {
    const input = 'prose with em-dash — and content'
    expect(aiFilter(input)).toBe('prose with em-dash — and content')
  })
})

describe('aiFilter — mda-section marker stripping', () => {
  it('strips <!-- mda-section --> open markers', () => {
    const input = '<!-- mda-section priority="high" -->\nContent\n<!-- /mda-section -->'
    expect(aiFilter(input)).toBe('Content')
  })

  it('strips <!-- mda-section --> with id attribute', () => {
    const input = '<!-- mda-section priority="critical" id="intro" -->\nIntro\n<!-- /mda-section -->'
    expect(aiFilter(input)).toBe('Intro')
  })

  it('strips close marker <!-- /mda-section -->', () => {
    const input = 'Line A\n<!-- /mda-section -->\nLine B'
    expect(aiFilter(input)).toBe('Line A\nLine B')
  })
})

describe('aiFilter — HTML comment stripping', () => {
  it('strips plain HTML comments', () => {
    expect(aiFilter('before\n<!-- a comment -->\nafter')).toBe('before\nafter')
  })

  it('preserves chunk marker comments', () => {
    const input = 'before\n---chunk:section-1---\nafter'
    expect(aiFilter(input)).toBe('before\n---chunk:section-1---\nafter')
  })

  it('strips mda-section comments but not chunk markers', () => {
    const input = '<!-- mda-section priority="high" -->\ntext\n---chunk:sep---\n<!-- /mda-section -->'
    const result = aiFilter(input)
    expect(result).toContain('text')
    expect(result).toContain('---chunk:sep---')
    expect(result).not.toContain('mda-section')
  })
})

describe('aiFilter — blank line compression', () => {
  it('compresses runs of blank lines to one', () => {
    expect(aiFilter('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('removes leading blank lines', () => {
    expect(aiFilter('\n\ntext')).toBe('text')
  })

  it('removes trailing blank lines', () => {
    expect(aiFilter('text\n\n')).toBe('text')
  })

  it('compressBlank=false preserves multiple blanks', () => {
    const result = aiFilter('a\n\n\nb', { compressBlank: false })
    expect(result).toBe('a\n\n\nb')
  })
})

describe('aiFilter — standalone bold label stripping', () => {
  it('strips **Label:** alone on a line', () => {
    expect(aiFilter('**Note:**\nContent here.')).toBe('Note:\nContent here.')
  })

  it('strips **Warning:**', () => {
    expect(aiFilter('**Warning:**')).toBe('Warning:')
  })

  it('preserves inline bold that has surrounding text', () => {
    expect(aiFilter('This is **bold** text.')).toBe('This is **bold** text.')
  })

  it('preserves bold in the middle of a sentence', () => {
    expect(aiFilter('Use **this** approach.')).toBe('Use **this** approach.')
  })
})

describe('aiFilter — idempotency', () => {
  it('applying twice yields same result', () => {
    const input = '## Heading\n\nContent\n\n---\n\nMore content'
    const once = aiFilter(input)
    const twice = aiFilter(once)
    expect(twice).toBe(once)
  })

  it('applying to already-clean output is stable', () => {
    const clean = 'Simple markdown\n\nWith paragraphs'
    expect(aiFilter(clean)).toBe(clean)
  })
})

describe('aiFilter — table handling', () => {
  it('tables mode preserve keeps markdown tables unchanged', () => {
    const table = '| Name | Value |\n|------|-------|\n| foo  | bar   |'
    expect(aiFilter(table, { tables: 'preserve' })).toBe(table)
  })

  it('tables mode kv converts 2-column table to key-value pairs', () => {
    const table = '| Key | Value |\n|-----|-------|\n| foo | bar |\n| baz | qux |'
    const result = aiFilter(table, { tables: 'kv' })
    expect(result).toContain('**foo:** bar')
    expect(result).toContain('**baz:** qux')
    expect(result).not.toContain('| Key |')
  })

  it('tables mode kv does not convert 3-column tables', () => {
    const table = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |'
    const result = aiFilter(table, { tables: 'kv' })
    expect(result).toContain('| A | B | C |')
  })
})

describe('aiFilter — full pipeline content', () => {
  it('strips all noise from a complex document', () => {
    const input = [
      '<!-- mda-section priority="high" -->',
      '## Section',
      '',
      '**Note:**',
      'Content here.',
      '',
      '---',
      '',
      'More content.',
      '<!-- /mda-section -->',
    ].join('\n')
    const result = aiFilter(input)
    expect(result).toContain('## Section')
    expect(result).toContain('Content here')
    expect(result).toContain('More content')
    expect(result).not.toContain('mda-section')
    expect(result).not.toContain('---')
    expect(result).not.toContain('**Note:**')
  })
})
