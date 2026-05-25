import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import { loadPluginsSync, detectPlugin, clearPluginCache } from '../plugin-loader.js'
import type { LoadedPlugin } from '../plugin-loader.js'

const EXAMPLE_PLUGIN_CONTENT = `---
markdownai_plugin: "1.0"
plugin_name: example-framework
plugin_version: 1.0.0
description: ExampleFramework project integration
---
@markdownai v1.0

@plugin-meta
  framework_name: ExampleFramework
  framework_version: ">=1.0.0"
  marker_version: exf-v1
@end

@plugin-detect
  required_dirs:
    - .exf
  required_files:
    - exf.config.json
@end

@plugin-layout
  directories:
    .exf/: ExampleFramework root directory
  files:
    exf.config.json: Main configuration file
@end
`

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

describe('@markdownai-detect engine directive', () => {
  it('emits plugin names for detected plugins (as=text)', () => {
    // Plugin is in tmpDir/.markdownai/plugins/ (set up in beforeEach)
    // Create detection signals in tmpDir so detectPlugin passes
    mkdirSync(join(tmpDir, '.exf'))
    writeFileSync(join(tmpDir, 'exf.config.json'), '{}')
    const src = `@markdownai\n@markdownai-detect project=${tmpDir}`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('example-framework')
  })

  it('emits (no plugins detected) when nothing matches', () => {
    // Plugin loaded but .exf dir and exf.config.json not present - won't match
    const src = `@markdownai\n@markdownai-detect project=${tmpDir}`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('no plugins detected')
  })

  it('includes layout section when include=layout and as=info', () => {
    mkdirSync(join(tmpDir, '.exf'))
    writeFileSync(join(tmpDir, 'exf.config.json'), '{}')
    const src = `@markdownai\n@markdownai-detect as=info include=layout project=${tmpDir}`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('Layout')
    expect(result.output).toContain('.exf/')
  })

  it('stores output in ctx.envFiles when label= is set', () => {
    const src = `@markdownai\n@markdownai-detect label=detected_plugins project=${tmpDir}`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
  })
})
