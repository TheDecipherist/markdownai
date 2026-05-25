import type { MarkdownaiDetectNode, PluginDataNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { loadPluginsSync, detectPlugin, getPluginSync } from './plugin-loader.js'
import type { LoadedPlugin, PluginLayout, PluginConventions, PluginMeta, PluginDetect } from './plugin-loader.js'

const PLUGIN_FILE_ONLY = new Set(['plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions'])

function resolveProjectRoot(override: string | null, ctx: EngineContext): string {
  return override && override.length > 0 ? override : ctx.cwd
}

function formatMeta(meta: PluginMeta): string {
  return `Framework: ${meta.framework_name} / v${meta.framework_version} / marker: ${meta.marker_version}`
}

function formatDetect(detect: PluginDetect): string {
  const lines: string[] = []
  if (detect.required_dirs?.length) {
    lines.push('Required dirs:')
    for (const d of detect.required_dirs) lines.push(`  ${d}`)
  }
  if (detect.required_files?.length) {
    lines.push('Required files:')
    for (const f of detect.required_files) lines.push(`  ${f}`)
  }
  if (detect.required_marker) lines.push(`Required marker: ${detect.required_marker}`)
  if (detect.version_signal) {
    const vs = detect.version_signal
    lines.push(`Version signal: ${vs.type}:${vs.target} field=${vs.field} expected=${vs.expected}`)
  }
  return lines.join('\n')
}

function formatLayout(layout: PluginLayout): string {
  const lines: string[] = []
  if (layout.directories) {
    for (const [path, desc] of Object.entries(layout.directories)) {
      lines.push(`  ${path.padEnd(25)} ${desc}`)
    }
  }
  if (layout.files) {
    for (const [path, desc] of Object.entries(layout.files)) {
      lines.push(`  ${path.padEnd(25)} ${desc}`)
    }
  }
  if (layout.tree) lines.push(layout.tree)
  return lines.join('\n')
}

function formatConventions(conventions: PluginConventions): string {
  const lines: string[] = []
  if (conventions.naming) {
    for (const [key, val] of Object.entries(conventions.naming)) {
      lines.push(`  ${key}: ${val}`)
    }
  }
  if (conventions.required_frontmatter_fields?.length) {
    lines.push(`Required frontmatter: ${conventions.required_frontmatter_fields.join(', ')}`)
  }
  return lines.join('\n')
}

function formatPluginSummary(plugin: LoadedPlugin, include: string[], format: 'text' | 'info'): string {
  const includeAll = include.includes('all')
  const header = `${plugin.name} (v${plugin.version})${plugin.description ? ` - ${plugin.description}` : ''}`
  const sections: string[] = []

  if (includeAll || include.includes('meta')) {
    sections.push(format === 'info' ? `**Meta**\n${formatMeta(plugin.meta)}` : formatMeta(plugin.meta))
  }
  if (includeAll || include.includes('detect')) {
    const detectStr = formatDetect(plugin.detect)
    if (detectStr) sections.push(format === 'info' ? `**Detection**\n${detectStr}` : detectStr)
  }
  if ((includeAll || include.includes('layout')) && plugin.layout) {
    const layoutStr = formatLayout(plugin.layout)
    if (layoutStr) sections.push(format === 'info' ? `**Layout**\n${layoutStr}` : `Layout:\n${layoutStr}`)
  }
  if ((includeAll || include.includes('conventions')) && plugin.conventions) {
    const convStr = formatConventions(plugin.conventions)
    if (convStr) sections.push(format === 'info' ? `**Conventions**\n${convStr}` : `Conventions:\n${convStr}`)
  }

  if (format === 'info') {
    const body = sections.length > 0 ? '\n' + sections.join('\n\n') : ''
    return `### ${header}${body}`
  }
  return sections.length > 0 ? `${header}\n${sections.join('\n')}` : header
}

export function executeMarkdownaiDetect(node: MarkdownaiDetectNode, ctx: EngineContext): string {
  const projectRoot = resolveProjectRoot(node.projectOverride, ctx)
  const { plugins, warnings } = loadPluginsSync(projectRoot)
  for (const w of warnings) ctx.warnings.push(w)

  const matched = plugins.filter(p => detectPlugin(p, projectRoot))

  let output: string
  if (matched.length === 0) {
    output = '(no plugins detected)'
  } else if (node.format === 'info') {
    const entries = matched.map(p => formatPluginSummary(p, node.include, 'info'))
    output = `## Detected Plugins\n\n${entries.join('\n\n')}`
  } else {
    output = matched.map(p => formatPluginSummary(p, node.include, 'text')).join('\n')
  }

  if (node.label) ctx.envFiles[node.label] = output
  return output
}

export function executePluginData(node: PluginDataNode, ctx: EngineContext): string {
  const projectRoot = resolveProjectRoot(node.projectOverride, ctx)
  const { warnings } = loadPluginsSync(projectRoot)
  for (const w of warnings) ctx.warnings.push(w)

  const plugin = getPluginSync(node.name, projectRoot)
  if (!plugin) {
    const msg = `[plugin-data: plugin "${node.name}" not found]`
    ctx.warnings.push(`@plugin-data: plugin "${node.name}" not found`)
    if (node.label) ctx.envFiles[node.label] = msg
    return msg
  }

  const output = formatPluginSummary(plugin, node.include, 'info')
  if (node.label) ctx.envFiles[node.label] = output
  return output
}

export { PLUGIN_FILE_ONLY }
