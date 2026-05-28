import { resolve } from 'node:path'
import type { MarkdownaiDetectNode, PluginDataNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { loadPluginsSync, detectPlugin, getPluginSync } from './plugin-loader.js'
import type { LoadedPlugin, PluginLayout, PluginConventions, PluginMeta, PluginDetect } from './plugin-loader.js'

const PLUGIN_FILE_ONLY = new Set(['plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions'])

function resolveProjectRoot(override: string | null, ctx: EngineContext): string {
  if (!override || override.length === 0) return ctx.cwd
  const resolved = resolve(ctx.cwd, override)
  const jail = ctx.security.jailRoot
  if (jail !== null && !resolved.startsWith(jail + '/') && resolved !== jail) {
    ctx.warnings.push(`@markdownai-detect: projectOverride "${override}" escapes jail — using cwd`)
    return ctx.cwd
  }
  return resolved
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

  if (node.label) {
    // Text form retained in envFiles for inline rendering.
    ctx.envFiles[node.label] = output
    // Structured form in ctx.data so callers can navigate the result:
    //   {{ info.detected }}, {{ info.frameworks.mdd.layout.directories.features }}
    ctx.data[node.label] = buildDetectStruct(matched, node.include)
  }
  return output
}

interface FrameworkRecord {
  name: string
  framework_version: string
  marker_version: string
  meta?: PluginMeta
  detect?: PluginDetect
  layout?: PluginLayout
  conventions?: PluginConventions
}

interface DetectStruct {
  detected: boolean
  count: number
  frameworks: Record<string, FrameworkRecord>
}

function buildDetectStruct(matched: LoadedPlugin[], include: string[]): DetectStruct {
  const wantsLayout = include.includes('layout') || include.includes('all')
  const wantsAll = include.includes('all')
  const frameworks: Record<string, FrameworkRecord> = {}
  for (const p of matched) {
    const entry: FrameworkRecord = {
      name: p.name,
      framework_version: p.meta?.framework_version ?? '',
      marker_version: p.meta?.marker_version ?? '',
      meta: p.meta,
    }
    if (wantsLayout && p.layout) entry.layout = p.layout
    if (wantsAll) {
      entry.detect = p.detect
      if (p.conventions) entry.conventions = p.conventions
    }
    frameworks[p.name] = entry
  }
  return {
    detected: matched.length > 0,
    count: matched.length,
    frameworks,
  }
}

export function executePluginData(node: PluginDataNode, ctx: EngineContext): string {
  const projectRoot = resolveProjectRoot(node.projectOverride, ctx)
  const { warnings } = loadPluginsSync(projectRoot)
  for (const w of warnings) ctx.warnings.push(w)

  const plugin = getPluginSync(node.name, projectRoot)
  if (!plugin) {
    const msg = `[plugin-data: plugin "${node.name}" not found]`
    ctx.warnings.push(`@plugin-data: plugin "${node.name}" not found`)
    if (node.label) {
      ctx.envFiles[node.label] = msg
      ctx.data[node.label] = { found: false, name: node.name }
    }
    return msg
  }

  const output = formatPluginSummary(plugin, node.include, 'info')
  if (node.label) {
    ctx.envFiles[node.label] = output
    // Direct struct access to the plugin's descriptor without going
    // through @markdownai-detect's project scan.
    ctx.data[node.label] = {
      found: true,
      name: plugin.name,
      framework_version: plugin.meta?.framework_version ?? '',
      marker_version: plugin.meta?.marker_version ?? '',
      meta: plugin.meta,
      detect: plugin.detect,
      layout: plugin.layout,
      conventions: plugin.conventions,
    }
  }
  return output
}

export { PLUGIN_FILE_ONLY }
