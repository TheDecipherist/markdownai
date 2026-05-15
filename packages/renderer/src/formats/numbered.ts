import type { FormatModule, RendererInput } from '../types.js'

const numbered: FormatModule = {
  name: 'numbered',
  render(input: RendererInput): string {
    return input.data.map((item, i) => `${i + 1}. ${item}`).join('\n')
  },
}

export default numbered
