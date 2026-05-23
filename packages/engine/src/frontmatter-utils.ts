// Shared YAML frontmatter helpers used by @update-frontmatter (write) and
// @read-frontmatter (read).
//
// Supported subset: leading `---\n` ... `\n---\n` block at the very top of a
// markdown file, top-level scalar or list fields. List values are returned as
// their raw YAML representation so callers can interpolate them as-is. Nested
// objects and multi-line scalars are out of scope.

export const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/

export interface FrontmatterParse {
  fullBlock: string  // includes the `---` delimiters and trailing newline
  body: string       // content between the delimiters (no surrounding ---)
}

export function extractFrontmatter(content: string): FrontmatterParse | null {
  const m = content.match(FRONTMATTER_RE)
  if (!m) return null
  return { fullBlock: m[0] ?? '', body: m[1] ?? '' }
}

function escapeRegex(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export function fieldRegex(field: string): RegExp {
  return new RegExp(`^(${escapeRegex(field)}):[ \\t]*(.*)$`, 'm')
}

/**
 * Read a single top-level frontmatter field's value. Returns null if the file
 * has no frontmatter block. Returns empty string if the field is absent.
 *
 * For scalar values returns the trimmed value (no surrounding quotes stripped).
 * For YAML list fields (inline `field: [a, b]` or block `field:\n  - a\n  - b`)
 * returns the raw text including the surrounding brackets / hyphens — callers
 * can interpolate it directly.
 */
export function readFrontmatterField(content: string, field: string): string | null {
  const fm = extractFrontmatter(content)
  if (!fm) return null
  const re = fieldRegex(field)
  const m = fm.body.match(re)
  if (!m) return ''
  const scalar = (m[2] ?? '').trim()
  // Inline list: `field: [a, b, c]` — scalar already captures it.
  if (scalar !== '') return scalar
  // Block list: `field:\n  - a\n  - b`. Capture every subsequent indented line
  // starting with `-` until indentation drops or the block ends.
  const lines = fm.body.split('\n')
  const fieldLineIdx = lines.findIndex(l => re.test(l))
  if (fieldLineIdx === -1) return ''
  const items: string[] = []
  for (let i = fieldLineIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^\s+-\s/.test(line)) {
      items.push(line.trim().replace(/^-\s*/, ''))
      continue
    }
    if (line === '' || /^\s/.test(line)) continue
    break
  }
  return items.length > 0 ? items.join(', ') : ''
}
