#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { readFile } from './tools/read_file.js'
import { listPhases } from './tools/list_phases.js'
import { resolvePhase } from './tools/resolve_phase.js'
import { nextPhase } from './tools/next_phase.js'
import { callMacro } from './tools/call_macro.js'
import { getEnv } from './tools/get_env.js'
import { executeDirective } from './tools/execute_directive.js'
import { invalidateCache } from './tools/invalidate_cache.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

export interface ServerOptions {
  cwd?: string
  port?: number
}

function respond(id: string | number | null, result: unknown): void {
  const resp: JsonRpcResponse = { jsonrpc: '2.0', id, result }
  process.stdout.write(JSON.stringify(resp) + '\n')
}

function respondError(id: string | number | null, code: number, message: string): void {
  const resp: JsonRpcResponse = { jsonrpc: '2.0', id, error: { code, message } }
  process.stdout.write(JSON.stringify(resp) + '\n')
}

function handleRequest(req: JsonRpcRequest, cwd: string): void {
  const p = req.params ?? {}
  try {
    switch (req.method) {
      case 'initialize':
        respond(req.id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'markdownai', version: '1.0.0' },
        })
        break
      case 'notifications/initialized':
        // No response needed for notifications
        break
      case 'tools/list':
        respond(req.id, {
          tools: [
            { name: 'read_file', description: 'Read and render a MarkdownAI document', inputSchema: { type: 'object', properties: { path: { type: 'string' }, phase: { type: 'string' } }, required: ['path'] } },
            { name: 'list_phases', description: 'List all phases in a MarkdownAI document', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
            { name: 'resolve_phase', description: 'Resolve a named phase in a document', inputSchema: { type: 'object', properties: { file: { type: 'string' }, phase: { type: 'string' } }, required: ['file', 'phase'] } },
            { name: 'next_phase', description: 'Get the next phase after current_phase', inputSchema: { type: 'object', properties: { file: { type: 'string' }, current_phase: { type: 'string' } }, required: ['file', 'current_phase'] } },
            { name: 'call_macro', description: 'Call a named macro in a document', inputSchema: { type: 'object', properties: { file: { type: 'string' }, macro: { type: 'string' }, args: { type: 'object' } }, required: ['file', 'macro'] } },
            { name: 'get_env', description: 'Get an environment variable value', inputSchema: { type: 'object', properties: { key: { type: 'string' }, fallback: { type: 'string' } }, required: ['key'] } },
            { name: 'execute_directive', description: 'Execute a MarkdownAI directive string', inputSchema: { type: 'object', properties: { directive: { type: 'string' } }, required: ['directive'] } },
            { name: 'invalidate_cache', description: 'Invalidate the directive cache', inputSchema: { type: 'object', properties: { directive: { type: 'string' } } } },
          ],
        })
        break
      case 'tools/call': {
        const toolName = String((p['name'] as string) ?? '')
        const toolParams = (p['arguments'] as Record<string, unknown>) ?? {}
        const syntheticReq: JsonRpcRequest = { jsonrpc: '2.0', id: req.id, method: toolName, params: toolParams }
        handleRequest(syntheticReq, cwd)
        break
      }
      case 'read_file': {
        const rfArgs: Parameters<typeof readFile>[0] = { path: String(p['path'] ?? '') }
        if (p['phase'] != null) rfArgs.phase = String(p['phase'])
        respond(req.id, readFile(rfArgs, cwd))
        break
      }
      case 'list_phases':
        respond(req.id, listPhases(String(p['file'] ?? ''), cwd))
        break
      case 'resolve_phase':
        respond(req.id, resolvePhase(String(p['file'] ?? ''), String(p['phase'] ?? ''), cwd))
        break
      case 'next_phase':
        respond(req.id, nextPhase(String(p['file'] ?? ''), String(p['current_phase'] ?? ''), cwd))
        break
      case 'call_macro': {
        const rawArgs = p['args']
        const macroArgs: Record<string, string> = (typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs))
          ? Object.fromEntries(Object.entries(rawArgs).map(([k, v]) => [k, String(v)]))
          : {}
        respond(req.id, callMacro(String(p['file'] ?? ''), String(p['macro'] ?? ''), macroArgs, cwd))
        break
      }
      case 'get_env':
        respond(req.id, getEnv(String(p['key'] ?? ''), p['fallback'] != null ? String(p['fallback']) : undefined))
        break
      case 'execute_directive':
        respond(req.id, executeDirective(String(p['directive'] ?? ''), cwd))
        break
      case 'invalidate_cache':
        respond(req.id, invalidateCache(p['directive'] != null ? String(p['directive']) : undefined))
        break
      default:
        respondError(req.id, -32601, `Method not found: ${req.method}`)
    }
  } catch (err) {
    respondError(req.id, -32603, String(err))
  }
}

export function startServer(options: ServerOptions = {}): void {
  const cwd = options.cwd ?? process.cwd()
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      const req = JSON.parse(trimmed) as JsonRpcRequest
      handleRequest(req, cwd)
    } catch {
      respondError(null, -32700, 'Parse error')
    }
  })
  rl.on('close', () => process.exit(0))
}
