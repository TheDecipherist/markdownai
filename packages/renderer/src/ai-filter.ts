export interface AiFilterOptions {
  tables?: 'preserve' | 'kv'
  compressBlank?: boolean
}

const CHUNK_MARKER = /^---chunk:[^-].*---$/
const SECTION_MARKER = /^<!--\s*mda-section\b|^<!--\s*\/mda-section\s*-->/
const PRESERVED_COMMENT = /^<!--\s*chunk:/

export function aiFilter(markdown: string, options: AiFilterOptions = {}): string {
  const compressBlank = options.compressBlank !== false
  const tableMode = options.tables ?? 'preserve'

  const lines = markdown.split('\n')
  const out: string[] = []
  let blankRun = 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    const trimmed = raw.trimEnd()

    // Strip mda-section markers (structural comments for budget pass, not for AI output)
    if (SECTION_MARKER.test(trimmed)) continue

    // Strip HTML comments that aren't chunk markers
    if (trimmed.startsWith('<!--') && !PRESERVED_COMMENT.test(trimmed) && !CHUNK_MARKER.test(trimmed)) continue

    // Strip bare horizontal rules
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed) || /^___+$/.test(trimmed)) continue

    const stripped = trimmed.trimStart()

    // Trailing whitespace already removed; handle blank lines
    if (trimmed === '') {
      blankRun++
      if (compressBlank && blankRun > 1) continue
      out.push('')
      continue
    }
    blankRun = 0

    // Optionally convert 2-column tables to key-value pairs
    if (tableMode === 'kv' && trimmed.startsWith('|')) {
      const converted = tryConvertTableLine(lines, i)
      if (converted !== null) {
        for (const l of converted.lines) out.push(l)
        i += converted.skip
        blankRun = 0
        continue
      }
    }

    // Strip standalone bold labels at start of line (decorative, not inline emphasis)
    // e.g. "**Note:**" alone on a line → "Note:"
    const standaloneLabel = stripped.match(/^\*\*([^*]+)\*\*\s*$/)
    if (standaloneLabel) {
      out.push(standaloneLabel[1]!)
      continue
    }

    out.push(trimmed)
  }

  // Remove leading/trailing blank lines
  while (out.length > 0 && out[0] === '') out.shift()
  while (out.length > 0 && out[out.length - 1] === '') out.pop()

  return out.join('\n')
}

interface TableConversion {
  lines: string[]
  skip: number
}

function tryConvertTableLine(lines: string[], startIdx: number): TableConversion | null {
  // Collect table block starting at startIdx
  const tableLines: string[] = []
  let i = startIdx
  while (i < lines.length && (lines[i] ?? '').trimEnd().startsWith('|')) {
    tableLines.push((lines[i] ?? '').trimEnd())
    i++
  }

  if (tableLines.length < 2) return null

  // Parse header + separator + data rows
  const header = splitCells(tableLines[0] ?? '')
  const separator = tableLines[1] ?? ''
  if (!separator.includes('-')) return null
  if (header.length !== 2) return null

  const dataRows = tableLines.slice(2)
  const result: string[] = []
  for (const row of dataRows) {
    const cells = splitCells(row)
    if (cells.length !== 2) return null
    result.push(`**${cells[0]}:** ${cells[1]}`)
  }

  return { lines: result, skip: tableLines.length - 1 }
}

function splitCells(row: string): string[] {
  return row.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1)
}
