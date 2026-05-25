import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadPlugins, getPlugin, clearPluginCache } from '../plugin-loader.js'

const VALID_META_BLOCK = '@plugin-meta\n  framework_name: "TestFW"\n  framework_version: "1.0"\n  marker_version: "1.0"\n@end'
const VALID_DETECT_BLOCK = '@plugin-detect\n  required_marker: "@markdownai v1.0"\n@end'

function makePluginFile(pluginName: string, extraBlocks = ''): string {
  return [
    '---',
    `markdownai_plugin: "1.0"`,
    `plugin_name: "${pluginName}"`,
    `plugin_version: "1.0"`,
    `description: "A test plugin"`,
    '---',
    '@markdownai v1.0',
    '',
    VALID_META_BLOCK,
    VALID_DETECT_BLOCK,
    extraBlocks,
  ].join('\n')
}

let tmpDir: string

beforeEach(() => {
  clearPluginCache()
  tmpDir = join(tmpdir(), `mai-plugin-test-${Date.now()}`)
  mkdirSync(join(tmpDir, '.markdownai', 'plugins'), { recursive: true })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  clearPluginCache()
})

describe('loadPlugins', () => {
  it('returns empty plugins array when no plugin files exist', async () => {
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('loads a valid plugin from the project-local search path', async () => {
    writeFileSync(
      join(tmpDir, '.markdownai', 'plugins', 'testfw.plugin.md'),
      makePluginFile('testfw'),
    )
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toHaveLength(1)
    expect(result.plugins[0]?.name).toBe('testfw')
    expect(result.plugins[0]?.version).toBe('1.0')
    expect(result.plugins[0]?.meta.framework_name).toBe('TestFW')
  })

  it('rejects a plugin where plugin_name does not match filename stem', async () => {
    writeFileSync(
      join(tmpDir, '.markdownai', 'plugins', 'mismatch.plugin.md'),
      makePluginFile('wrong-name'),
    )
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toHaveLength(0)
    expect(result.warnings.some(w => w.includes('mismatch'))).toBe(true)
  })

  it('rejects a plugin missing required plugin_name frontmatter field', async () => {
    const content = [
      '---',
      'markdownai_plugin: "1.0"',
      'plugin_version: "1.0"',
      '---',
      '@markdownai v1.0',
      VALID_META_BLOCK,
      VALID_DETECT_BLOCK,
    ].join('\n')
    writeFileSync(join(tmpDir, '.markdownai', 'plugins', 'noname.plugin.md'), content)
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('rejects a plugin containing an executable directive (@http)', async () => {
    const content = makePluginFile('evil') + '\n@http https://evil.example.com'
    writeFileSync(join(tmpDir, '.markdownai', 'plugins', 'evil.plugin.md'), content)
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toHaveLength(0)
    expect(result.warnings.some(w => w.includes('executable'))).toBe(true)
  })

  it('rejects a plugin containing an executable directive (@if)', async () => {
    const content = makePluginFile('evil2') + '\n@if true\ntest\n@endif'
    writeFileSync(join(tmpDir, '.markdownai', 'plugins', 'evil2.plugin.md'), content)
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toHaveLength(0)
    expect(result.warnings.some(w => w.includes('executable'))).toBe(true)
  })

  it('rejects a plugin missing required @plugin-meta block', async () => {
    const content = [
      '---',
      'markdownai_plugin: "1.0"',
      'plugin_name: "nometa"',
      'plugin_version: "1.0"',
      '---',
      '@markdownai v1.0',
      VALID_DETECT_BLOCK,
    ].join('\n')
    writeFileSync(join(tmpDir, '.markdownai', 'plugins', 'nometa.plugin.md'), content)
    const result = await loadPlugins(tmpDir)
    expect(result.plugins).toHaveLength(0)
    expect(result.warnings.some(w => w.includes('plugin-meta'))).toBe(true)
  })

  it('loads plugin-layout block when present', async () => {
    const layout = [
      '@plugin-layout',
      '  directories:',
      '    features: ".mdd/docs/"',
      '@end',
    ].join('\n')
    writeFileSync(
      join(tmpDir, '.markdownai', 'plugins', 'withlay.plugin.md'),
      makePluginFile('withlay', layout),
    )
    const result = await loadPlugins(tmpDir)
    expect(result.plugins[0]?.layout?.directories?.['features']).toBe('.mdd/docs/')
  })

  it('uses session cache — second call does not re-scan filesystem', async () => {
    writeFileSync(
      join(tmpDir, '.markdownai', 'plugins', 'cached.plugin.md'),
      makePluginFile('cached'),
    )
    const result1 = await loadPlugins(tmpDir)
    const result2 = await loadPlugins(tmpDir)
    expect(result1).toBe(result2)
  })
})

describe('getPlugin', () => {
  it('returns null when plugin not found', async () => {
    const plugin = await getPlugin('does-not-exist', tmpDir)
    expect(plugin).toBeNull()
  })

  it('returns the loaded plugin by name', async () => {
    writeFileSync(
      join(tmpDir, '.markdownai', 'plugins', 'byname.plugin.md'),
      makePluginFile('byname'),
    )
    const plugin = await getPlugin('byname', tmpDir)
    expect(plugin?.name).toBe('byname')
    expect(plugin?.meta.framework_name).toBe('TestFW')
  })
})

describe('clearPluginCache', () => {
  it('clears cache so next loadPlugins re-scans', async () => {
    writeFileSync(
      join(tmpDir, '.markdownai', 'plugins', 'clearme.plugin.md'),
      makePluginFile('clearme'),
    )
    const r1 = await loadPlugins(tmpDir)
    clearPluginCache()
    const r2 = await loadPlugins(tmpDir)
    expect(r1).not.toBe(r2)
    expect(r1.plugins[0]?.name).toBe(r2.plugins[0]?.name)
  })
})
