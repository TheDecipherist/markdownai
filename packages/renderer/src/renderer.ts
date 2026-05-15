import type { RendererInput, FormatModule, RenderType } from './types.js'
import list from './formats/list.js'
import numbered from './formats/numbered.js'
import links from './formats/links.js'
import table from './formats/table.js'
import code from './formats/code.js'
import inline from './formats/inline.js'
import bar from './formats/bar.js'
import flow from './formats/flow.js'
import tree from './formats/tree.js'
import timeline from './formats/timeline.js'
import json from './formats/json.js'

const modules: FormatModule[] = [
  list, numbered, links, table, code, inline, bar, flow, tree, timeline, json,
]

const registry = new Map<RenderType, FormatModule>(
  modules.map(m => [m.name, m])
)

const VALID_TYPES = modules.map(m => m.name).join(', ')

export function render(input: RendererInput): string {
  const mod = registry.get(input.type)
  if (!mod) {
    throw new Error(`Unknown render type: "${input.type}". Valid types: ${VALID_TYPES}`)
  }
  return mod.render(input)
}
