import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function dist(pkg: string, entry = 'index.js'): string {
  return join(ROOT, 'packages', pkg, 'dist', entry)
}

describe('@markdownai/parser — run state', () => {
  it('dist/index.js resolves and exports parse()', async () => {
    const mod = await import(dist('parser'))
    expect(typeof mod.parse).toBe('function')
  })

  it('parse() returns an AST with nodes for a valid document', async () => {
    const { parse } = await import(dist('parser'))
    const result = parse('@markdownai v1.0\n\nHello world')
    expect(result).toBeDefined()
    expect(Array.isArray(result.nodes)).toBe(true)
    expect(result.nodes.length).toBeGreaterThan(0)
  })

  it('parse() does not throw on a plain markdown document', async () => {
    const { parse } = await import(dist('parser'))
    expect(() => parse('# Just markdown\n\nNo directives.')).not.toThrow()
  })

  it('dist/index.js exports scanInterpolations()', async () => {
    const mod = await import(dist('parser'))
    expect(typeof mod.scanInterpolations).toBe('function')
  })

  it('scanInterpolations() returns spans for text with {{ }} interpolation', async () => {
    const { scanInterpolations } = await import(dist('parser'))
    const spans = scanInterpolations('Hello {{ name }} world')
    expect(Array.isArray(spans)).toBe(true)
    expect(spans.length).toBeGreaterThan(0)
    expect(spans[0].expression).toBe('name')
  })

  it('dist/index.js exports scanShellInlines()', async () => {
    const mod = await import(dist('parser'))
    expect(typeof mod.scanShellInlines).toBe('function')
  })

  it('scanShellInlines() returns spans for text with shell inlines', async () => {
    const { scanShellInlines } = await import(dist('parser'))
    const text = `Run !` + '`date`' + ` to see the time`
    const spans = scanShellInlines(text)
    expect(Array.isArray(spans)).toBe(true)
    expect(spans.length).toBeGreaterThan(0)
    expect(spans[0].command).toBe('date')
  })
})
