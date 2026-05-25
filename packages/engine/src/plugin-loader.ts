import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { parse } from '@markdownai/parser'
import type { ASTNode, PluginMetaNode, PluginDetectNode, PluginLayoutNode, PluginConventionsNode } from '@markdownai/parser'
import { extractFrontmatter, readFrontmatterField } from './frontmatter-utils.js'

export interface VersionSignal {
  type: string
  target: string
  field: string
  expected: string
}

export interface PluginMeta {
  framework_name: string
  framework_version: string
  marker_version: string
}

export interface PluginDetect {
  required_marker?: string
  required_files?: string[]
  required_dirs?: string[]
  version_signal?: VersionSignal
}

export interface PluginLayout {
  directories?: Record<string, string>
  files?: Record<string, string>
  tree?: string
}

export interface PluginConventions {
  naming?: Record<string, string>
  required_frontmatter_fields?: string[]
}

export interface LoadedPlugin {
  name: string
  version: string
  description?: string
  homepage?: string
  sourcePath: string
  meta: PluginMeta
  detect: PluginDetect
  layout?: PluginLayout
  conventions?: PluginConventions
}

export interface PluginLoadResult {
  plugins: LoadedPlugin[]
  warnings: string[]
}

// AST node types that are allowed in plugin files (no execution surface)
const ALLOWED_NODE_TYPES = new Set([
  'markdown', 'passthrough', 'header', 'note', 'define-concept', 'constraint',
  'plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions',
])

// Session cache: key is projectRoot
const pluginCache = new Map<string, PluginLoadResult>()

export function clearPluginCache(): void {
  pluginCache.clear()
}

export async function loadPlugins(projectRoot = process.cwd()): Promise<PluginLoadResult> {
  const cached = pluginCache.get(projectRoot)
  if (cached) return cached

  const searchPaths = [
    join(projectRoot, '.markdownai', 'plugins'),
    join(homedir(), '.markdownai', 'plugins'),
    '/usr/share/markdownai/plugins',
  ]

  const warnings: string[] = []
  // name -> {plugin, sourcePath} — higher-precedence path wins on collision
  const byName = new Map<string, LoadedPlugin>()

  for (const dir of searchPaths) {
    if (!existsSync(dir)) continue
    let entries: string[]
    try {
      entries = readdirSync(dir).filter(f => f.endsWith('.plugin.md'))
    } catch {
      continue
    }

    for (const filename of entries) {
      const filePath = join(dir, filename)
      const stem = basename(filename, '.plugin.md')
      const result = loadOnePlugin(filePath, stem)
      if (result.warning) {
        warnings.push(result.warning)
        continue
      }
      const plugin = result.plugin!
      if (byName.has(plugin.name)) {
        warnings.push(`Plugin "${plugin.name}" from ${filePath} overridden by higher-precedence path`)
        continue
      }
      byName.set(plugin.name, plugin)
    }
  }

  const outcome: PluginLoadResult = { plugins: [...byName.values()], warnings }
  pluginCache.set(projectRoot, outcome)
  return outcome
}

export async function getPlugin(name: string, projectRoot = process.cwd()): Promise<LoadedPlugin | null> {
  const { plugins } = await loadPlugins(projectRoot)
  return plugins.find(p => p.name === name) ?? null
}

function loadOnePlugin(filePath: string, stem: string): { plugin?: LoadedPlugin; warning?: string } {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return { warning: `${filePath}: could not read file` }
  }

  // Frontmatter validation
  const fm = extractFrontmatter(content)
  if (!fm) return { warning: `${filePath}: no YAML frontmatter found` }

  const schemaVersion = readFrontmatterField(content, 'markdownai_plugin')
  if (!schemaVersion) return { warning: `${filePath}: missing required field markdownai_plugin` }

  const pluginName = readFrontmatterField(content, 'plugin_name')
  if (!pluginName) return { warning: `${filePath}: missing required field plugin_name` }

  const pluginVersion = readFrontmatterField(content, 'plugin_version')
  if (!pluginVersion) return { warning: `${filePath}: missing required field plugin_version` }

  // Strip surrounding quotes from field values (frontmatter-utils returns raw YAML)
  const name = stripQuotes(pluginName)
  const version = stripQuotes(pluginVersion)
  const descRaw = readFrontmatterField(content, 'description')
  const description = descRaw ? stripQuotes(descRaw) : undefined
  const homepageRaw = readFrontmatterField(content, 'homepage')
  const homepage = homepageRaw ? stripQuotes(homepageRaw) : undefined

  // plugin_name must match filename stem
  if (name !== stem) {
    return { warning: `${filePath}: plugin_name "${name}" does not match filename stem "${stem}"` }
  }

  // Parse the file and check for executable directives
  let nodes: ASTNode[]
  try {
    nodes = parse(content).nodes
  } catch {
    return { warning: `${filePath}: parse error` }
  }

  const executableNode = nodes.find(n => !ALLOWED_NODE_TYPES.has(n.type))
  if (executableNode) {
    return { warning: `${filePath}: contains executable directive "${executableNode.type}" — plugin files may not contain executable directives` }
  }

  // Extract required plugin blocks
  const metaNode = nodes.find(n => n.type === 'plugin-meta') as PluginMetaNode | undefined
  if (!metaNode) return { warning: `${filePath}: missing required @plugin-meta block` }

  const detectNode = nodes.find(n => n.type === 'plugin-detect') as PluginDetectNode | undefined
  if (!detectNode) return { warning: `${filePath}: missing required @plugin-detect block` }

  const layoutNode = nodes.find(n => n.type === 'plugin-layout') as PluginLayoutNode | undefined
  const conventionsNode = nodes.find(n => n.type === 'plugin-conventions') as PluginConventionsNode | undefined

  const meta = parsePluginMeta(metaNode.body)
  if (!meta) return { warning: `${filePath}: @plugin-meta block missing required fields` }

  const detect = parsePluginDetect(detectNode.body)
  const layout = layoutNode ? parsePluginLayout(layoutNode.body) : undefined
  const conventions = conventionsNode ? parsePluginConventions(conventionsNode.body) : undefined

  const plugin: LoadedPlugin = { name, version, sourcePath: filePath, meta, detect }
  if (description) plugin.description = description
  if (homepage) plugin.homepage = homepage
  if (layout) plugin.layout = layout
  if (conventions) plugin.conventions = conventions

  return { plugin }
}

// ---- Minimal YAML-like body parsers ----

type YamlValue = string | string[] | Record<string, string> | undefined

function parseBody(body: string): Record<string, YamlValue> {
  const lines = body.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return {}

  // Determine the base indent level (minimum indent among non-empty lines)
  const baseIndent = lines.reduce((min, l) => {
    const trimmed = l.trimStart()
    if (!trimmed) return min
    return Math.min(min, l.length - trimmed.length)
  }, Infinity)

  return parseBodyAtIndent(lines, baseIndent)
}

function parseBodyAtIndent(lines: string[], baseIndent: number): Record<string, YamlValue> {
  const result: Record<string, YamlValue> = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length
    if (indent !== baseIndent || !trimmed.includes(':')) { i++; continue }

    const colonIdx = trimmed.indexOf(':')
    const key = trimmed.slice(0, colonIdx).trim()
    const rest = trimmed.slice(colonIdx + 1).trim()

    if (rest === '|') {
      // Multi-line literal block: collect all subsequent more-indented lines
      const blockLines: string[] = []
      i++
      while (i < lines.length) {
        const bl = lines[i] ?? ''
        const bt = bl.trimStart()
        if (bl.length - bt.length <= baseIndent && bt !== '') break
        blockLines.push(bl)
        i++
      }
      result[key] = blockLines.join('\n')
      continue
    }

    if (rest === '') {
      // List or nested object — collect child lines at deeper indent
      const children: string[] = []
      i++
      while (i < lines.length) {
        const cl = lines[i] ?? ''
        const ct = cl.trimStart()
        const ci = cl.length - ct.length
        if (ci <= baseIndent && ct !== '') break
        if (ct) children.push(cl)
        i++
      }
      if (children.length === 0) { result[key] = undefined; continue }
      const firstChild = children[0]?.trimStart() ?? ''
      if (firstChild.startsWith('- ')) {
        // List
        result[key] = children
          .map(c => c.trimStart())
          .filter(c => c.startsWith('- '))
          .map(c => stripQuotes(c.slice(2).trim()))
      } else {
        // Nested object (one level) — recurse with child indent
        const childIndent = (children[0]?.length ?? 0) - firstChild.length
        result[key] = parseBodyAtIndent(children, childIndent) as Record<string, string>
      }
      continue
    }

    result[key] = stripQuotes(rest)
    i++
  }
  return result
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function parsePluginMeta(body: string): PluginMeta | null {
  const data = parseBody(body)
  const framework_name = data['framework_name']
  const framework_version = data['framework_version']
  const marker_version = data['marker_version']
  if (typeof framework_name !== 'string' || typeof framework_version !== 'string' || typeof marker_version !== 'string') return null
  return { framework_name, framework_version, marker_version }
}

function parsePluginDetect(body: string): PluginDetect {
  const data = parseBody(body)
  const detect: PluginDetect = {}
  if (typeof data['required_marker'] === 'string') detect.required_marker = data['required_marker']
  if (Array.isArray(data['required_files'])) detect.required_files = data['required_files'] as string[]
  if (Array.isArray(data['required_dirs'])) detect.required_dirs = data['required_dirs'] as string[]
  const vs = data['version_signal']
  if (vs && typeof vs === 'object' && !Array.isArray(vs)) {
    const vsObj = vs as Record<string, string>
    if (vsObj['type'] && vsObj['target'] && vsObj['field'] && vsObj['expected']) {
      detect.version_signal = {
        type: vsObj['type'],
        target: vsObj['target'],
        field: vsObj['field'],
        expected: vsObj['expected'],
      }
    }
  }
  return detect
}

function parsePluginLayout(body: string): PluginLayout {
  const data = parseBody(body)
  const layout: PluginLayout = {}
  const dirs = data['directories']
  if (dirs && typeof dirs === 'object' && !Array.isArray(dirs)) {
    layout.directories = dirs as Record<string, string>
  }
  const files = data['files']
  if (files && typeof files === 'object' && !Array.isArray(files)) {
    layout.files = files as Record<string, string>
  }
  if (typeof data['tree'] === 'string') layout.tree = data['tree']
  return layout
}

function parsePluginConventions(body: string): PluginConventions {
  const data = parseBody(body)
  const conventions: PluginConventions = {}
  const naming = data['naming']
  if (naming && typeof naming === 'object' && !Array.isArray(naming)) {
    conventions.naming = naming as Record<string, string>
  }
  if (Array.isArray(data['required_frontmatter_fields'])) {
    conventions.required_frontmatter_fields = data['required_frontmatter_fields'] as string[]
  }
  return conventions
}
