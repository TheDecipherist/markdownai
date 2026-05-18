import type { FormatModule, RendererInput } from '../types.js'

const timeline: FormatModule = {
  name: 'timeline',
  render(input: RendererInput): string {
    return input.data.map((item, i) => `${i + 1}. ${item}`).join('\n')
  },
}

export default timeline
