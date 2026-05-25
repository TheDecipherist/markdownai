import { describe, it, expect } from 'vitest'
import { parse } from '../parser.js'
import type { EventNode } from '../types.js'

const DOC = '@markdownai\n'

function event(src: string): EventNode | undefined {
  return parse(src).nodes.find(n => n.type === 'event') as EventNode | undefined
}

describe('@event parser', () => {
  it('parses name and data correctly', () => {
    const n = event(`${DOC}@event name='step-done' data='setup'`)
    expect(n?.name).toBe('step-done')
    expect(n?.data).toBe('setup')
  })

  it('parses a single transport into transports array', () => {
    const n = event(`${DOC}@event name='x' data='v' transport='log'`)
    expect(n?.transports).toEqual(['log'])
  })

  it('parses multiple comma-separated transports into string[]', () => {
    const n = event(`${DOC}@event name='x' data='v' transport='log,mcp,vscode'`)
    expect(n?.transports).toEqual(['log', 'mcp', 'vscode'])
  })

  it('trims and lowercases transport names', () => {
    const n = event(`${DOC}@event name='x' data='v' transport='LOG , MCP'`)
    expect(n?.transports).toEqual(['log', 'mcp'])
  })

  it("defaults transports to ['log'] when transport arg is omitted", () => {
    const n = event(`${DOC}@event name='x' data='v'`)
    expect(n?.transports).toEqual(['log'])
  })

  it('parses visible flag as true when present', () => {
    const n = event(`${DOC}@event name='x' data='v' transport='log' visible`)
    expect(n?.visible).toBe(true)
  })

  it('visible defaults to false when not present', () => {
    const n = event(`${DOC}@event name='x' data='v' transport='log'`)
    expect(n?.visible).toBe(false)
  })

  it('throws ParseError when name is missing', () => {
    expect(() => parse(`${DOC}@event data='v'`)).toThrow()
  })

  it('defaults data to empty string when omitted (signal events)', () => {
    const n = event(`${DOC}@event name='progress-tick'`)
    expect(n?.name).toBe('progress-tick')
    expect(n?.data).toBe('')
  })

  it('accepts empty-payload events with a transport set', () => {
    const n = event(`${DOC}@event name='heartbeat' transport='log'`)
    expect(n?.name).toBe('heartbeat')
    expect(n?.data).toBe('')
    expect(n?.transports).toEqual(['log'])
  })

  it('stores line number on node', () => {
    const n = event(`${DOC}@event name='x' data='v'`)
    expect(typeof n?.line).toBe('number')
    expect(n!.line).toBeGreaterThanOrEqual(1)
  })

  it('accepts JSON string in data without error', () => {
    const n = event(`${DOC}@event name='prog' data='{"step":2,"total":5}' transport='log'`)
    expect(n?.data).toBe('{"step":2,"total":5}')
  })

  it('handles whitespace around transport comma separators', () => {
    const n = event(`${DOC}@event name='x' data='v' transport='log , mcp , vscode'`)
    expect(n?.transports).toEqual(['log', 'mcp', 'vscode'])
  })
})
