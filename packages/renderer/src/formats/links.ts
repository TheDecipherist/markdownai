import type { FormatModule, RendererInput } from '../types.js'

function linkText(path: string): string {
  const last = path.split('/').at(-1) ?? path
  return last.replace(/\.\w+$/, '')
}

const links: FormatModule = {
  name: 'links',
  render(input: RendererInput): string {
    return input.data.map(path => `- [${linkText(path)}](${path})`).join('\n')
  },
}

export default links
