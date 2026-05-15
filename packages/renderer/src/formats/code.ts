import type { FormatModule, RendererInput } from '../types.js'

const code: FormatModule = {
  name: 'code',
  render(input: RendererInput): string {
    const lang = input.options?.['lang'] ?? ''
    return `\`\`\`${lang}\n${input.data.join('\n')}\n\`\`\``
  },
}

export default code
