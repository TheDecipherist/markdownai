import type { FormatModule, RendererInput } from '../types.js'

const timeline: FormatModule = {
  name: 'timeline',
  render(input: RendererInput): string {
    return input.data.join(' ──► ')
  },
}

export default timeline
