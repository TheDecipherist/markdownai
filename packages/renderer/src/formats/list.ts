import type { FormatModule, RendererInput } from '../types.js'

const list: FormatModule = {
  name: 'list',
  render(input: RendererInput): string {
    return input.data.map(item => `- ${item}`).join('\n')
  },
}

export default list
