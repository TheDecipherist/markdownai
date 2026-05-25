import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { MarkdownaiDetectNode, PluginDataNode } from '../types.js'

const DOC = '@markdownai\n'

function firstNode<T>(src: string, type: string): T | undefined {
  return parse(src).nodes.find(n => n.type === type) as T | undefined
}

describe('@markdownai-detect parser', () => {
  it('parses with no args using defaults', () => {
    const src = `${DOC}@markdownai-detect`
    const n = firstNode<MarkdownaiDetectNode>(src, 'markdownai-detect')
    expect(n, 'node should be defined').toBeDefined()
    expect(n?.type).toBe('markdownai-detect')
    expect(n?.format).toBe('text')
    expect(n?.include).toEqual([])
    expect(n?.label).toBeNull()
    expect(n?.projectOverride).toBeNull()
  })

  it('parses as=info format', () => {
    const src = `${DOC}@markdownai-detect as=info`
    const n = firstNode<MarkdownaiDetectNode>(src, 'markdownai-detect')
    expect(n?.format).toBe('info')
  })

  it('parses include= as array of section names', () => {
    const src = `${DOC}@markdownai-detect include="layout,conventions"`
    const n = firstNode<MarkdownaiDetectNode>(src, 'markdownai-detect')
    expect(n?.include).toContain('layout')
    expect(n?.include).toContain('conventions')
  })

  it('parses label= into label field', () => {
    const src = `${DOC}@markdownai-detect label=detected`
    const n = firstNode<MarkdownaiDetectNode>(src, 'markdownai-detect')
    expect(n?.label).toBe('detected')
  })

  it('parses project= into projectOverride field', () => {
    const src = `${DOC}@markdownai-detect project=/tmp/myproject`
    const n = firstNode<MarkdownaiDetectNode>(src, 'markdownai-detect')
    expect(n?.projectOverride).toBe('/tmp/myproject')
  })
})

describe('@plugin-data parser', () => {
  it('parses name= as required arg', () => {
    const src = `${DOC}@plugin-data name=mdd`
    const n = firstNode<PluginDataNode>(src, 'plugin-data')
    expect(n).toBeDefined()
    expect(n?.type).toBe('plugin-data')
    expect(n?.name).toBe('mdd')
    expect(n?.include).toEqual([])
    expect(n?.label).toBeNull()
  })

  it('parses quoted name= value', () => {
    const src = `${DOC}@plugin-data name="my-plugin"`
    const n = firstNode<PluginDataNode>(src, 'plugin-data')
    expect(n?.name).toBe('my-plugin')
  })

  it('parses include= as sections array', () => {
    const src = `${DOC}@plugin-data name=mdd include="layout,meta"`
    const n = firstNode<PluginDataNode>(src, 'plugin-data')
    expect(n?.include).toContain('layout')
    expect(n?.include).toContain('meta')
  })

  it('throws ParseError when name= is missing', () => {
    const src = `${DOC}@plugin-data`
    expect(() => parse(src)).toThrow('@plugin-data requires name=')
  })
})
