import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import { loadPluginsSync, detectPlugin, clearPluginCache } from '../plugin-loader.js'
import type { LoadedPlugin } from '../plugin-loader.js'

const EXAMPLE_PLUGIN_CONTENT = `---\nmarkdownai_plugin: "1.0"\nplugin_name: example-framework\nplugin_version: 1.0.0\ndescription: ExampleFramework project integration\n---\n@markdownai v1.0\n\n@plugin-meta\n  framework_name: ExampleFramework\n  framework_version: ">=1.0.0"\n  marker_version: exf-v1\n@plugin-meta-end\n\n@plugin-detect\n  required_dirs:\n    - .exf\n  required_files:\n    - exf.config.json\n@plugin-detect-end\n\n@plugin-layout\n  directories:\n    .exf/: ExampleFramework root directory\n  files:\n    exf.config.json: Main configuration file\n@plugin-layout-end\n`

let tmpDir: string
let pluginsDir: string
let projectDir: string

beforeEach(() => {
  clearPluginCache()
  tmpDir = join(tmpdir(), `mai-detect-test-${Date.now()}`)
  pluginsDir = join(tmpDir, '.markdownai', 'plugins')
  projectDir = join(tmpDir, 'project')
  mkdirSync(pluginsDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(pluginsDir, 'example-framework.plugin.md'), EXAMPLE_PLUGIN_CONTENT)
})

afterEach(() => {
  clearPluginCache()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('loadPluginsSync', () => {
  it('loads plugins synchronously from project search path', () => {
    const result = loadPluginsSync(tmpDir)
    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.name).toBe('example-framework')
  })

  it('returns empty plugins when no search paths have plugins', () => {
    const result = loadPluginsSync(projectDir)
    expect(result.plugins).toHaveLength(0)
  })

  it('uses cache on second call with same projectRoot', () => {
    const r1 = loadPluginsSync(tmpDir)
    const r2 = loadPluginsSync(tmpDir)
    expect(r1).toBe(r2)
  })
})

describe('detectPlugin', () => {
  it('returns false when required_dirs are missing', () => {
    const result = loadPluginsSync(tmpDir)
    const plugin = result.plugins[0]!
    const detected = detectPlugin(plugin, projectDir)
    expect(detected).toBe(false)
  })

  it('returns true when all required_dirs and required_files exist', () => {
    mkdirSync(join(projectDir, '.exf'))
    writeFileSync(join(projectDir, 'exf.config.json'), '{}')
    const result = loadPluginsSync(tmpDir)
    const plugin = result.plugins[0]!
    const detected = detectPlugin(plugin, projectDir)
    expect(detected).toBe(true)
  })

  it('returns false when required_files are missing', () => {
    mkdirSync(join(projectDir, '.exf'))
    // exf.config.json not created
    const result = loadPluginsSync(tmpDir)
    const plugin = result.plugins[0]!
    const detected = detectPlugin(plugin, projectDir)
    expect(detected).toBe(false)
  })
})

describe('@markdownai-detect engine directive /', () => {
  it('emits plugin names for detected plugins (as=text)', () => {
    // Plugin is in tmpDir/.markdownai/plugins/ (set up in beforeEach)
    // Create detection signals in tmpDir so detectPlugin passes
    mkdirSync(join(tmpDir, '.exf'))
    writeFileSync(join(tmpDir, 'exf.config.json'), '{}')
    const src = `@markdownai\n@markdownai-detect project=${tmpDir} /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('example-framework')
  })

  it('emits (no plugins detected) when nothing matches', () => {
    // Plugin loaded but .exf dir and exf.config.json not present - won't match
    const src = `@markdownai\n@markdownai-detect project=${tmpDir} /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('no plugins detected')
  })

  it('includes layout section when include=layout and as=info', () => {
    mkdirSync(join(tmpDir, '.exf'))
    writeFileSync(join(tmpDir, 'exf.config.json'), '{}')
    const src = `@markdownai\n@markdownai-detect as=info include=layout project=${tmpDir} /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('Layout')
    expect(result.output).toContain('.exf/')
  })

  it('stores output in ctx.envFiles when label= is set', () => {
    const src = `@markdownai\n@markdownai-detect label=detected_plugins project=${tmpDir} /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
  })

  it('populates ctx.data with a typed struct (detected, count, frameworks) when label= is set', () => {
    mkdirSync(join(tmpDir, '.exf'))
    writeFileSync(join(tmpDir, 'exf.config.json'), '{}')
    const ctx: Partial<import('../context.js').EngineContext> = { cwd: tmpDir, data: {} }
    const src = `@markdownai\n@markdownai-detect label=info include=layout project=${tmpDir} /`
    const ast = parse(src)
    const result = execute(ast, { ctx })
    expect(result.errors).toHaveLength(0)
    const info = ctx.data?.['info'] as Record<string, unknown> | undefined
    expect(info).toBeDefined()
    expect(info?.['detected']).toBe(true)
    expect(info?.['count']).toBe(1)
    const frameworks = info?.['frameworks'] as Record<string, unknown>
    expect(frameworks['example-framework']).toBeDefined()
    const efw = frameworks['example-framework'] as Record<string, unknown>
    expect(efw['framework_version']).toBe('>=1.0.0')
    expect(efw['layout']).toBeDefined()
  })

  it('lets interpolations navigate struct via dot syntax: {{ info.detected }}', () => {
    mkdirSync(join(tmpDir, '.exf'))
    writeFileSync(join(tmpDir, 'exf.config.json'), '{}')
    const src = `@markdownai\n@markdownai-detect label=info include=layout project=${tmpDir} /\n\n` +
      `detected: {{ info.detected }}\n` +
      `count: {{ info.count }}\n` +
      `fw version: {{ info.frameworks["example-framework"].framework_version }}\n`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir, data: {} } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('detected: true')
    expect(result.output).toContain('count: 1')
    expect(result.output).toContain('fw version: >=1.0.0')
  })

  it('reports detected=false and empty frameworks when no plugins match', () => {
    // No .exf dir + no config -> plugin loaded but doesn't match
    const ctx: Partial<import('../context.js').EngineContext> = { cwd: tmpDir, data: {} }
    const src = `@markdownai\n@markdownai-detect label=info project=${tmpDir} /`
    const ast = parse(src)
    execute(ast, { ctx })
    const info = ctx.data?.['info'] as Record<string, unknown> | undefined
    expect(info?.['detected']).toBe(false)
    expect(info?.['count']).toBe(0)
    expect(Object.keys(info?.['frameworks'] as Record<string, unknown>)).toEqual([])
  })
})
