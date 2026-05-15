import type { FormatModule, RendererInput } from '../types.js'

const flow: FormatModule = {
  name: 'flow',
  render(input: RendererInput): string {
    return input.data.join(' ──► ')
  },
}

export default flow
