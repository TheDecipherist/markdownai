import type { FormatModule, RendererInput } from '../types.js'

const BAR_WIDTH = 20

interface BarRow { label: string; value: number }

function parseBarRow(line: string): BarRow {
  const parts = line.trim().split(/\s+/)
  const last = parts.at(-1) ?? ''
  const value = parseFloat(last)
  const label = isNaN(value)
    ? line
    : parts.slice(0, -1).join(' ')
  return { label, value: isNaN(value) ? 0 : value }
}

const bar: FormatModule = {
  name: 'bar',
  render(input: RendererInput): string {
    const rows = input.data.map(parseBarRow)
    const maxValue = rows.reduce((m, r) => Math.max(m, r.value), 1)
    const maxLabel = rows.reduce((m, r) => Math.max(m, r.label.length), 0)

    return rows.map(({ label, value }) => {
      const bars = Math.max(1, Math.round((value / maxValue) * BAR_WIDTH))
      const barStr = '█'.repeat(bars)
      return `${label.padEnd(maxLabel)}  ${barStr} ${value}`
    }).join('\n')
  },
}

export default bar
