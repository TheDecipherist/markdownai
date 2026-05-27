import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import { clearPluginCache } from '../plugin-loader.js'

const EXAMPLE_PLUGIN_CONTENT = `---\nmarkdownai_plugin: "1.0"\nplugin_name: example-framework\nplugin_version: 1.0.0\ndescription: ExampleFramework project integration\nhomepage: https://example-framework.dev\n---\n@markdownai v1.0\n\n@plugin-meta\n  framework_name: ExampleFramework\n  framework_version: ">=1.0.0"\n  marker_version: exf-v1\n@plugin-meta-end\n\n@plugin-detect\n  required_dirs:\n    - .exf\n@plugin-detect-end\n\n@plugin-layout\n  directories:\n    .exf/: ExampleFramework root directory\n@plugin-layout-end\n\n@plugin-conventions\n  naming:\n    template_files: kebab-case with .exf.md extension\n@plugin-conventions-end\n`

let tmpDir: string

beforeEach(() => {
  clearPluginCache()
  tmpDir = join(tmpdir(), `mai-plugin-data-test-${Date.now()}`)
  const pluginsDir = join(tmpDir, '.markdownai', 'plugins')
  mkdirSync(pluginsDir, { recursive: true })
  writeFileSync(join(pluginsDir, 'example-framework.plugin.md'), EXAMPLE_PLUGIN_CONTENT)
})

afterEach(() => {
  clearPluginCache()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('@plugin-data engine directive /', () => {
  it('returns plugin name and version for known plugin', () => {
    const src = `@markdownai\n@plugin-data name=example-framework /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('example-framework')
    expect(result.output).toContain('1.0.0')
  })

  it('returns not-found string for unknown plugin', () => {
    const src = `@markdownai\n@plugin-data name=nonexistent /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('not found')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('includes layout when include=layout', () => {
    const src = `@markdownai\n@plugin-data name=example-framework include=layout /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('Layout')
    expect(result.output).toContain('.exf/')
  })

  it('includes conventions when include=conventions', () => {
    const src = `@markdownai\n@plugin-data name=example-framework include=conventions /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('Conventions')
  })

  it('includes all sections when include=all', () => {
    const src = `@markdownai\n@plugin-data name=example-framework include=all /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
    expect(result.output).toContain('ExampleFramework')
    expect(result.output).toContain('Layout')
    expect(result.output).toContain('Conventions')
  })

  it('stores result in ctx.envFiles when label= is set', () => {
    const src = `@markdownai\n@plugin-data name=example-framework label=plugin_info /`
    const ast = parse(src)
    const result = execute(ast, { ctx: { cwd: tmpDir } })
    expect(result.errors).toHaveLength(0)
  })
})
