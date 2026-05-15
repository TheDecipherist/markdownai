import type { FormatModule, RendererInput } from '../types.js'

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const json: FormatModule = {
  name: 'json',
  render(input: RendererInput): string {
    const raw = input.data.join('\n')
    return `\`\`\`json\n${prettyJson(raw)}\n\`\`\``
  },
}

export default json
