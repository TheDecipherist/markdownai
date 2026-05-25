import { getAvailableDirectives } from '@markdownai/parser'
import type { DirectiveInfo } from '@markdownai/parser'

const PLUGIN_FILE_ONLY_NAMES = new Set(['plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions'])

export interface AvailableDirectivesInput {
  include_plugin_directives?: boolean
}

export interface AvailableDirectivesResult {
  directives: DirectiveInfo[]
  count: number
}

export function availableDirectives(input: AvailableDirectivesInput): AvailableDirectivesResult {
  const includePluginDirectives = input.include_plugin_directives !== false
  let directives = getAvailableDirectives()
  if (!includePluginDirectives) {
    directives = directives.filter(d => !PLUGIN_FILE_ONLY_NAMES.has(d.name))
  }
  return { directives, count: directives.length }
}
