import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type {
  PluginMetaNode,
  PluginDetectNode,
  PluginLayoutNode,
  PluginConventionsNode,
} from '../types.js'

const DOC = '@markdownai\n'

function firstNode<T>(src: string, type: string): T | undefined {
  return parse(src).nodes.find(n => n.type === type) as T | undefined
}

describe('@plugin-meta parser', () => {
  it('parses a plugin-meta block and captures raw body', () => {
    const src = `${DOC}@plugin-meta\n  framework_name: "MDD"\n  framework_version: "2.0"\n@end`
    const n = firstNode<PluginMetaNode>(src, 'plugin-meta')
    expect(n).toBeDefined()
    expect(n?.type).toBe('plugin-meta')
    expect(n?.body).toContain('framework_name')
    expect(n?.body).toContain('MDD')
  })

  it('preserves indented body content exactly', () => {
    const src = `${DOC}@plugin-meta\n  key: "value"\n  nested:\n    sub: "x"\n@end`
    const n = firstNode<PluginMetaNode>(src, 'plugin-meta')
    expect(n?.body).toContain('nested:')
    expect(n?.body).toContain('sub: "x"')
  })

  it('throws ParseError when block is unclosed', () => {
    const src = `${DOC}@plugin-meta\n  framework_name: "MDD"\n`
    expect(() => parse(src)).toThrow()
  })
})

describe('@plugin-detect parser', () => {
  it('parses a plugin-detect block and captures raw body', () => {
    const src = [
      DOC,
      '@plugin-detect',
      '  required_marker: "@markdownai v2.0"',
      '  required_files:',
      '    - ".mdd/settings.json"',
      '@end',
    ].join('\n')
    const n = firstNode<PluginDetectNode>(src, 'plugin-detect')
    expect(n).toBeDefined()
    expect(n?.type).toBe('plugin-detect')
    expect(n?.body).toContain('required_marker')
    expect(n?.body).toContain('@markdownai v2.0')
  })

  it('throws ParseError when block is unclosed', () => {
    const src = `${DOC}@plugin-detect\n  required_marker: "x"\n`
    expect(() => parse(src)).toThrow()
  })
})

describe('@plugin-layout parser', () => {
  it('parses a plugin-layout block and captures raw body', () => {
    const src = [
      DOC,
      '@plugin-layout',
      '  directories:',
      '    features: ".mdd/docs/"',
      '  files:',
      '    settings: ".mdd/settings.json"',
      '@end',
    ].join('\n')
    const n = firstNode<PluginLayoutNode>(src, 'plugin-layout')
    expect(n).toBeDefined()
    expect(n?.type).toBe('plugin-layout')
    expect(n?.body).toContain('directories:')
    expect(n?.body).toContain('.mdd/docs/')
  })

  it('throws ParseError when block is unclosed', () => {
    const src = `${DOC}@plugin-layout\n  directories:\n`
    expect(() => parse(src)).toThrow()
  })
})

describe('@plugin-conventions parser', () => {
  it('parses a plugin-conventions block and captures raw body', () => {
    const src = [
      DOC,
      '@plugin-conventions',
      '  naming:',
      '    feature_doc: "<NN>-<feature-slug>.md"',
      '  required_frontmatter_fields:',
      '    - id',
      '    - title',
      '@end',
    ].join('\n')
    const n = firstNode<PluginConventionsNode>(src, 'plugin-conventions')
    expect(n).toBeDefined()
    expect(n?.type).toBe('plugin-conventions')
    expect(n?.body).toContain('naming:')
    expect(n?.body).toContain('feature_doc')
  })

  it('throws ParseError when block is unclosed', () => {
    const src = `${DOC}@plugin-conventions\n  naming:\n`
    expect(() => parse(src)).toThrow()
  })
})

describe('plugin block coexistence', () => {
  it('parses all four plugin blocks in a single document', () => {
    const src = [
      DOC,
      '@plugin-meta',
      '  framework_name: "TestFW"',
      '@end',
      '@plugin-detect',
      '  required_marker: "@markdownai v1.0"',
      '@end',
      '@plugin-layout',
      '  directories:',
      '    features: ".fw/docs/"',
      '@end',
      '@plugin-conventions',
      '  naming:',
      '    doc: "<N>-<slug>.md"',
      '@end',
    ].join('\n')
    const result = parse(src)
    const types = result.nodes.map(n => n.type)
    expect(types).toContain('plugin-meta')
    expect(types).toContain('plugin-detect')
    expect(types).toContain('plugin-layout')
    expect(types).toContain('plugin-conventions')
  })

  it('records the correct line number for each plugin block', () => {
    const src = `${DOC}@plugin-meta\n  k: v\n@end\n@plugin-detect\n  k: v\n@end`
    const result = parse(src)
    const meta = result.nodes.find(n => n.type === 'plugin-meta') as PluginMetaNode
    const detect = result.nodes.find(n => n.type === 'plugin-detect') as PluginDetectNode
    expect(meta?.line).toBeDefined()
    expect(detect?.line).toBeDefined()
    expect(meta?.line).toBeLessThan(detect?.line ?? 0)
  })
})
