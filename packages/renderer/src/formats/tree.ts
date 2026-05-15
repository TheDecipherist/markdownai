import type { FormatModule, RendererInput } from '../types.js'

const tree: FormatModule = {
  name: 'tree',
  render(input: RendererInput): string {
    return `\`\`\`\n${input.data.join('\n')}\n\`\`\``
  },
}

export default tree
