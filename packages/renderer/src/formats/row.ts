import type { FormatModule, RendererInput } from '../types.js'

// `as=row` — used by @db to fetch a single document. The engine label-capture
// path lifts the first row into ctx.data so dot-access works in interpolations
// (`{{ feature.sourceFiles }}` etc.). The visible render is the parsed JSON
// of that single row — most callers will pair this with `visible=false` and
// reference the labeled struct elsewhere in the doc.
function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const row: FormatModule = {
  name: 'row',
  render(input: RendererInput): string {
    if (input.data.length === 0) return ''
    return `\`\`\`json\n${prettyJson(input.data[0] ?? '')}\n\`\`\``
  },
}

export default row
