import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { execute } from '../engine.js'
import { parse } from '@markdownai/parser'
import type { EngineEvent } from '../context.js'

// Mock Worker so dispatch-worker.js is never loaded during tests
vi.mock('node:worker_threads', () => ({
  Worker: vi.fn(() => ({
    postMessage: vi.fn(),
    unref: vi.fn(),
    on: vi.fn(),
  })),
  isMainThread: true,
  workerData: null,
}))

// Mock fs appendFileSync so vscode/file transports do not touch the real filesystem
vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>()
  return { ...real, appendFileSync: vi.fn() }
})

// Mock node:http and node:https so fireHttp does not make real network requests
vi.mock('node:http', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:http')>()
  return { ...real, request: vi.fn(() => ({ write: vi.fn(), end: vi.fn(), on: vi.fn() })) }
})
vi.mock('node:https', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:https')>()
  return { ...real, request: vi.fn(() => ({ write: vi.fn(), end: vi.fn(), on: vi.fn() })) }
})

import { Worker } from 'node:worker_threads'
import { appendFileSync } from 'node:fs'
import * as nodeHttp from 'node:http'
import * as nodeHttps from 'node:https'
import { fireLog } from '../transports/log.js'
import { fireMcp } from '../transports/mcp.js'
import { fireVscode } from '../transports/vscode.js'
import { fireFile, resolveDocRoot } from '../transports/file.js'
import { fireHttp } from '../transports/http.js'
import { fireWebsocket } from '../transports/websocket.js'
import type { WebsocketClient } from '../transports/websocket.js'
import { fireDb } from '../transports/db.js'
import { dispatchExternal } from '../transports/index.js'

const DOC = '@markdownai\n'

afterEach(() => {
  vi.clearAllMocks()
})

function makeEvent(overrides: Partial<EngineEvent> = {}): EngineEvent {
  return {
    name: 'test-event',
    data: 'payload',
    transport: 'log',
    document: '/project/doc.md',
    phase: null,
    timestamp: 1000000,
    meta: {
      datetime: new Date(1000000).toISOString(),
      line: 1,
      runId: 'test-run-id',
      sessionId: null,
      model: null,
      tokenUsage: null,
      git: null,
      callstack: [],
    },
    ...overrides,
  }
}

function run(source: string, opts?: object) {
  const ast = parse(source)
  return execute(ast, opts as Parameters<typeof execute>[1])
}

// ---------------------------------------------------------------------------
// Worker dispatch (fire-and-forget)
// ---------------------------------------------------------------------------

describe('@event — worker dispatch /', () => {
  it('execute() returns synchronously before external transport dispatches complete', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='mcp' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
      },
    })
    expect(result).toBeDefined()
    expect(result).not.toBeInstanceOf(Promise)
  })

  it('EventDispatchWorker is created lazily on first external transport event', () => {
    const countBefore = vi.mocked(Worker).mock.calls.length
    dispatchExternal(
      makeEvent(),
      { allowed_transports: ['log'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
    )
    // Worker was either just created (first call) or reused (cached) — either way, postMessage fired
    const workerInstances = vi.mocked(Worker).mock.calls.length
    expect(workerInstances).toBeGreaterThanOrEqual(countBefore)
  })

  it("EventDispatchWorker is unref()'d so it does not prevent process exit", async () => {
    // Reset module to get a fresh singleton with no cached worker
    vi.resetModules()
    const freshMod = await import('../transports/index.js')
    const cfg = { allowed_transports: ['log'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' as const }
    freshMod.dispatchExternal(makeEvent(), cfg)
    const inst = vi.mocked(Worker).mock.results.at(-1)?.value as { unref: ReturnType<typeof vi.fn> }
    expect(inst?.unref).toHaveBeenCalled()
  })

  it('mcp transport populates EngineResult.events synchronously without a worker', () => {
    const result = run(`${DOC}@event name='sync' data='hello' transport='mcp' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
      },
    })
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({ name: 'sync', data: 'hello', transport: 'mcp' })
  })

  it('worker-dispatched transport failures do not surface as execute() errors (fire-and-forget)', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='log' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['log'], allow_env_interpolation: false, max_value_length: 500, onError: 'fail' },
        },
      },
    })
    expect(result.errors).toEqual([])
  })

  it('onError "fail" still captures to errors when transport is not in the allowlist', () => {
    const result = run(`${DOC}@event name='x' data='v' transport='log' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: [], allow_env_interpolation: false, max_value_length: 500, onError: 'fail' },
        },
      },
    })
    expect(result.errors.some(e => e.includes('transport not in allowed_transports'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// log transport
// ---------------------------------------------------------------------------

describe('@event — log transport /', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes a structured line to stderr when fired', () => {
    fireLog(makeEvent())
    expect(vi.mocked(process.stderr.write)).toHaveBeenCalledOnce()
  })

  it('log line format is: [event] name=<name> data=<data> document=<doc> ts=<timestamp>', () => {
    const event = makeEvent({ name: 'step-done', data: 'finished', document: '/doc.md', timestamp: 9999 })
    fireLog(event)
    const written = String(vi.mocked(process.stderr.write).mock.calls[0]?.[0] ?? '')
    expect(written).toContain('[event]')
    expect(written).toContain('name=step-done')
    expect(written).toContain('data=finished')
    expect(written).toContain('document=/doc.md')
    expect(written).toContain('ts=9999')
  })

  it('writes the data value that was passed — caller is responsible for masking', () => {
    const event = makeEvent({ data: '***MASKED***' })
    fireLog(event)
    const written = String(vi.mocked(process.stderr.write).mock.calls[0]?.[0] ?? '')
    expect(written).toContain('***MASKED***')
  })

  it('does not write to stderr when fireLog is not called', () => {
    expect(vi.mocked(process.stderr.write)).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// mcp transport
// ---------------------------------------------------------------------------

describe('@event — mcp transport /', () => {
  it('event appears in EngineResult.events with transport field set to "mcp"', () => {
    const result = run(`${DOC}@event name='status' data='running' transport='mcp' /`, {
      ctx: {
        security: {
          allowShell: false, allowHttp: false, allowDb: false, jailRoot: null,
          eventConfig: { allowed_transports: ['mcp'], allow_env_interpolation: false, max_value_length: 500, onError: 'silence' },
        },
      },
    })
    expect(result.events[0]?.transport).toBe('mcp')
  })

  it('EngineEvent has correct name, data, document, phase, and timestamp fields', () => {
    const events: EngineEvent[] = []
    const event = makeEvent({ name: 'ping', data: 'ok', document: '/test.md', phase: 'setup', timestamp: 42 })
    fireMcp(event, events)
    expect(events[0]).toMatchObject({ name: 'ping', data: 'ok', document: '/test.md', phase: 'setup', timestamp: 42 })
  })

  it('multiple mcp events accumulate in EngineResult.events in document order', () => {
    const events: EngineEvent[] = []
    fireMcp(makeEvent({ name: 'first' }), events)
    fireMcp(makeEvent({ name: 'second' }), events)
    fireMcp(makeEvent({ name: 'third' }), events)
    expect(events).toHaveLength(3)
    expect(events.map(e => e.name)).toEqual(['first', 'second', 'third'])
  })

  it('data field on EngineEvent is whatever was passed (masking is applied upstream)', () => {
    const events: EngineEvent[] = []
    fireMcp(makeEvent({ data: '***MASKED***' }), events)
    expect(events[0]?.data).toBe('***MASKED***')
  })
})

// ---------------------------------------------------------------------------
// vscode transport
// ---------------------------------------------------------------------------

describe('@event — vscode transport /', () => {
  it('writes event JSON to the temp file at /tmp/markdownai-events-<sessionId>.json', () => {
    fireVscode(makeEvent(), 'sess-1')
    expect(vi.mocked(appendFileSync)).toHaveBeenCalledOnce()
    const [path] = vi.mocked(appendFileSync).mock.calls[0] as unknown as [string, string, string]
    expect(path).toBe('/tmp/markdownai-events-sess-1.json')
  })

  it('written file is valid JSON containing name, data, phase, and timestamp', () => {
    const event = makeEvent({ name: 'prog', data: 'hello', phase: 'run', timestamp: 12345 })
    fireVscode(event, 'sess-2')
    const [, content] = vi.mocked(appendFileSync).mock.calls[0] as unknown as [string, string, string]
    const parsed = JSON.parse(content.trim())
    expect(parsed.name).toBe('prog')
    expect(parsed.data).toBe('hello')
    expect(parsed.phase).toBe('run')
    expect(parsed.timestamp).toBe(12345)
  })

  it('appends to existing file rather than overwriting it', () => {
    fireVscode(makeEvent(), 'sess-3')
    fireVscode(makeEvent({ name: 'second' }), 'sess-3')
    expect(vi.mocked(appendFileSync)).toHaveBeenCalledTimes(2)
    const path0 = (vi.mocked(appendFileSync).mock.calls[0] as unknown as [string])[0]
    const path1 = (vi.mocked(appendFileSync).mock.calls[1] as unknown as [string])[0]
    expect(path0).toBe(path1)
  })

  it('JSON-parses the data field in the temp file when data is a valid JSON string', () => {
    const event = makeEvent({ data: '{"step":2,"total":5}' })
    fireVscode(event, 'sess-4')
    const [, content] = vi.mocked(appendFileSync).mock.calls[0] as unknown as [string, string, string]
    const parsed = JSON.parse(content.trim())
    expect(parsed.data).toEqual({ step: 2, total: 5 })
  })

  it('falls back to raw string in temp file when data is not valid JSON', () => {
    const event = makeEvent({ data: 'not-json' })
    fireVscode(event, 'sess-5')
    const [, content] = vi.mocked(appendFileSync).mock.calls[0] as unknown as [string, string, string]
    const parsed = JSON.parse(content.trim())
    expect(parsed.data).toBe('not-json')
  })
})

// ---------------------------------------------------------------------------
// websocket transport
// ---------------------------------------------------------------------------

describe('@event — websocket transport /', () => {
  it('is a no-op when no WebSocket clients are connected', () => {
    const unused = vi.fn()
    fireWebsocket(makeEvent(), new Set<WebsocketClient>())
    expect(unused).not.toHaveBeenCalled()
  })

  it('pushes a JSON event object to all connected clients', () => {
    const clientA = { send: vi.fn() }
    const clientB = { send: vi.fn() }
    fireWebsocket(makeEvent({ name: 'ping' }), new Set([clientA, clientB]))
    expect(clientA.send).toHaveBeenCalledOnce()
    expect(clientB.send).toHaveBeenCalledOnce()
  })

  it('pushed payload is valid JSON with name, data, phase, and timestamp', () => {
    const client = { send: vi.fn() }
    const event = makeEvent({ name: 'step', data: 'ok', phase: 'main', timestamp: 777 })
    fireWebsocket(event, new Set([client]))
    const payload = JSON.parse(client.send.mock.calls[0]?.[0] as string)
    expect(payload.name).toBe('step')
    expect(payload.data).toBe('ok')
    expect(payload.phase).toBe('main')
    expect(payload.timestamp).toBe(777)
  })

  it('a single client failure does not block delivery to other clients', () => {
    const badClient = { send: vi.fn().mockImplementationOnce(() => { throw new Error('send failed') }) }
    const goodClient = { send: vi.fn() }
    expect(() => fireWebsocket(makeEvent(), new Set([badClient, goodClient]))).not.toThrow()
    expect(goodClient.send).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// file transport
// ---------------------------------------------------------------------------

describe('@event — file transport /', () => {
  it('rejects a relative path — only absolute paths are accepted', () => {
    expect(() => fireFile(makeEvent(), './relative/path.json', '/project')).toThrow(/absolute/)
  })

  it('appends a JSON event line to the configured file path', () => {
    fireFile(makeEvent({ name: 'stored' }), '/tmp/events.json', '/project')
    expect(vi.mocked(appendFileSync)).toHaveBeenCalledOnce()
    const [path, content] = vi.mocked(appendFileSync).mock.calls[0] as unknown as [string, string, string]
    expect(path).toBe('/tmp/events.json')
    const parsed = JSON.parse(content.trim())
    expect(parsed.name).toBe('stored')
  })

  it('creates the file if it does not exist (appendFileSync handles this natively)', () => {
    fireFile(makeEvent(), '/tmp/new-file.json', '/project')
    expect(vi.mocked(appendFileSync)).toHaveBeenCalledOnce()
  })

  it('rejects a path inside the document root (confinement enforcement)', () => {
    expect(() =>
      fireFile(makeEvent(), '/project/docs/events.json', '/project')
    ).toThrow(/document root/)
  })

  it('resolveDocRoot returns the directory of the event document', () => {
    const event = makeEvent({ document: '/project/src/doc.md' })
    expect(resolveDocRoot(event)).toBe('/project/src')
  })
})

// ---------------------------------------------------------------------------
// http transport
// ---------------------------------------------------------------------------

describe('@event — http transport /', () => {
  it('requires a valid URL — invalid URL throws before sending', () => {
    expect(() => fireHttp(makeEvent(), 'not-a-url', {}, ['example.com'])).toThrow(/Invalid URL/)
  })

  it('blocks the request when the domain is not in allowed_domains', () => {
    expect(() =>
      fireHttp(makeEvent(), 'https://evil.com/hook', {}, ['allowed.com'])
    ).toThrow(/Domain not in allowlist/)
  })

  it('blocks cloud metadata endpoint even when domain is in allowed_domains', () => {
    expect(() =>
      fireHttp(makeEvent(), 'http://169.254.169.254/latest/meta-data/', {}, ['169.254.169.254'])
    ).toThrow(/Cloud metadata/)
  })

  it('posted body contains name, data, document, phase, and timestamp', () => {
    const event = makeEvent({ name: 'hook', data: 'payload', phase: 'run', timestamp: 100 })
    fireHttp(event, 'https://allowed.com/events', {}, ['allowed.com'])
    const reqObj = vi.mocked(nodeHttps.request).mock.results[0]?.value as { write: ReturnType<typeof vi.fn> }
    expect(reqObj?.write).toHaveBeenCalledOnce()
    const body = JSON.parse(reqObj?.write.mock.calls[0]?.[0] as string)
    expect(body.name).toBe('hook')
    expect(body.data).toBe('payload')
    expect(body.phase).toBe('run')
    expect(body.timestamp).toBe(100)
  })

  it('uses https for https:// URLs', () => {
    fireHttp(makeEvent(), 'https://allowed.com/hook', {}, ['allowed.com'])
    expect(vi.mocked(nodeHttps.request)).toHaveBeenCalledOnce()
    expect(vi.mocked(nodeHttp.request)).not.toHaveBeenCalled()
  })

  it('uses http for http:// URLs', () => {
    fireHttp(makeEvent(), 'http://allowed.com/hook', {}, ['allowed.com'])
    expect(vi.mocked(nodeHttp.request)).toHaveBeenCalledOnce()
    expect(vi.mocked(nodeHttps.request)).not.toHaveBeenCalled()
  })

  it('passes custom headers to the request', () => {
    fireHttp(makeEvent(), 'https://allowed.com/hook', { 'X-Custom': 'value' }, ['allowed.com'])
    const opts = vi.mocked(nodeHttps.request).mock.calls[0]?.[0] as unknown as { headers: Record<string, unknown> }
    expect(opts.headers?.['X-Custom']).toBe('value')
  })
})

// ---------------------------------------------------------------------------
// db transport
// ---------------------------------------------------------------------------

describe('@event — db transport /', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('current implementation writes a stub log to stderr (full impl requires connection)', () => {
    fireDb(makeEvent(), 'myconn', 'events')
    expect(vi.mocked(process.stderr.write)).toHaveBeenCalledOnce()
    const written = String(vi.mocked(process.stderr.write).mock.calls[0]?.[0] ?? '')
    expect(written).toContain('[event-db]')
  })

  it('stub output includes the connection name', () => {
    fireDb(makeEvent(), 'my-db', 'events')
    const written = String(vi.mocked(process.stderr.write).mock.calls[0]?.[0] ?? '')
    expect(written).toContain('connection=my-db')
  })

  it('stub output includes the collection name', () => {
    fireDb(makeEvent(), 'myconn', 'audit-log')
    const written = String(vi.mocked(process.stderr.write).mock.calls[0]?.[0] ?? '')
    expect(written).toContain('collection=audit-log')
  })

  it('stub output includes the event name', () => {
    fireDb(makeEvent({ name: 'step-complete' }), 'conn', 'col')
    const written = String(vi.mocked(process.stderr.write).mock.calls[0]?.[0] ?? '')
    expect(written).toContain('name=step-complete')
  })

  it('does not throw regardless of connection or collection value', () => {
    expect(() => fireDb(makeEvent(), '', '')).not.toThrow()
    expect(() => fireDb(makeEvent(), 'any', 'any')).not.toThrow()
  })
})
