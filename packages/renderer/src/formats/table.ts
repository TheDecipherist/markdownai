import type { FormatModule, RendererInput } from '../types.js'

function parseRow(line: string): string[] {
  return line.split('\t').map(c => c.trim())
}

const table: FormatModule = {
  name: 'table',
  render(input: RendererInput): string {
    const { data, columns } = input
    const hasExplicitColumns = columns !== undefined && columns.length > 0
    const headers = hasExplicitColumns ? columns! : (data[0] ? parseRow(data[0]) : [])
    const rows = hasExplicitColumns ? data.map(parseRow) : data.slice(1).map(parseRow)

    const colCount = headers.length
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
    )

    const pad = (s: string, w: number) => s.padEnd(w)
    const header = '| ' + headers.map((h, i) => pad(h, widths[i] ?? h.length)).join(' | ') + ' |'
    const sep = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|'
    const body = rows.map(row =>
      '| ' + Array.from({ length: colCount }, (_, i) =>
        pad(row[i] ?? '', widths[i] ?? 0)
      ).join(' | ') + ' |'
    )

    return [header, sep, ...body].join('\n')
  },
}

export default table
