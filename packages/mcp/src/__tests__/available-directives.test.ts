import { describe, it, expect } from 'vitest'
import { getAvailableDirectives } from '@markdownai/parser'
import { availableDirectives } from '../tools/available_directives.js'
import type { DirectiveInfo } from '@markdownai/parser'

describe('getAvailableDirectives (parser export)', () => {
  it('returns an array of directive info objects', () => {
    const directives = getAvailableDirectives()
    expect(Array.isArray(directives)).toBe(true)
    expect(directives.length).toBeGreaterThan(10)
  })

  it('each entry has name field', () => {
    const directives = getAvailableDirectives()
    for (const d of directives) {
      expect(typeof d.name).toBe('string')
    }
  })

  it('returns directives sorted alphabetically by name', () => {
    const directives = getAvailableDirectives()
    const names = directives.map(d => d.name)
    const sorted = [...names].sort()
    expect(names).toEqual(sorted)
  })

  it('includes env directive', () => {
    const directives = getAvailableDirectives()
    const envDir = directives.find(d => d.name === 'env')
    expect(envDir).toBeDefined()
  })

  it('includes plugin-detect', () => {
    const directives = getAvailableDirectives()
    const pd = directives.find(d => d.name === 'plugin-detect')
    expect(pd).toBeDefined()
  })

  it('includes markdownai-detect', () => {
    const directives = getAvailableDirectives()
    const md = directives.find(d => d.name === 'markdownai-detect')
    expect(md).toBeDefined()
  })

  it('includes plugin-data', () => {
    const directives = getAvailableDirectives()
    const pd = directives.find(d => d.name === 'plugin-data')
    expect(pd).toBeDefined()
  })
})

describe('availableDirectives MCP tool function', () => {
  it('returns directives and count', () => {
    const result = availableDirectives({})
    expect(result.directives).toBeDefined()
    expect(typeof result.count).toBe('number')
    expect(result.count).toBe(result.directives.length)
  })

  it('excludes plugin-only directives when include_plugin_directives=false', () => {
    const result = availableDirectives({ include_plugin_directives: false })
    const hasPluginOnly = result.directives.some(d =>
      ['plugin-meta', 'plugin-detect', 'plugin-layout', 'plugin-conventions'].includes(d.name)
    )
    expect(hasPluginOnly).toBe(false)
  })

  it('includes all directives by default', () => {
    const defaultResult = availableDirectives({})
    const explicitTrue = availableDirectives({ include_plugin_directives: true })
    expect(defaultResult.count).toBe(explicitTrue.count)
  })

  it('includes markdownai-detect and plugin-data even when include_plugin_directives=false', () => {
    const result = availableDirectives({ include_plugin_directives: false })
    const names = result.directives.map(d => d.name)
    expect(names).toContain('markdownai-detect')
    expect(names).toContain('plugin-data')
  })
})
