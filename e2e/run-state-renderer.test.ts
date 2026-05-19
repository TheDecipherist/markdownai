import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function dist(pkg: string, entry = 'index.js'): string {
  return join(ROOT, 'packages', pkg, 'dist', entry)
}

describe('@markdownai/renderer — run state', () => {
  it('dist/index.js resolves and exports render()', async () => {
    const mod = await import(dist('renderer'))
    expect(typeof mod.render).toBe('function')
  })

  it('render() returns a non-empty string for valid input', async () => {
    const { render } = await import(dist('renderer'))
    const output = render({ type: 'list', data: ['alpha', 'beta', 'gamma'] })
    expect(typeof output).toBe('string')
    expect(output.length).toBeGreaterThan(0)
    expect(output).toContain('alpha')
  })

  it('dist/index.js exports aiFilter()', async () => {
    const mod = await import(dist('renderer'))
    expect(typeof mod.aiFilter).toBe('function')
  })

  it('aiFilter() returns a string for markdown input', async () => {
    const { aiFilter } = await import(dist('renderer'))
    const result = aiFilter('# Hello\n\nSome text here.')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('aiFilter() strips HTML comments from markdown', async () => {
    const { aiFilter } = await import(dist('renderer'))
    const result = aiFilter('Before\n\n<!-- hidden -->\n\nAfter')
    expect(result).not.toContain('hidden')
  })
})
