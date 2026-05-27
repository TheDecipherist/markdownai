import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const ROOT = resolve(import.meta.dirname, '../..')
export const CLI = join(ROOT, 'packages/core/dist/cli.js')
export const MCP_FIXTURES = join(ROOT, 'e2e/mcp-fixtures')

export interface RpcResponse {
  jsonrpc: string
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

interface PendingCall {
  resolve: (r: RpcResponse) => void
  reject: (e: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface McpClient {
  proc: ChildProcess
  call(method: string, params?: Record<string, unknown>): Promise<RpcResponse>
  notify(method: string, params?: Record<string, unknown>): void
  close(): Promise<void>
}

export async function spawnMcpServer(cwd?: string): Promise<McpClient> {
  const workDir = cwd ?? MCP_FIXTURES
  const proc = spawn('node', [CLI, 'serve', '--cwd', workDir], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let idCounter = 1
  const pending = new Map<number | string, PendingCall>()

  const rl = createInterface({ input: proc.stdout! })
  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      const resp = JSON.parse(trimmed) as RpcResponse
      if (resp.id != null) {
        const p = pending.get(resp.id)
        if (p) {
          clearTimeout(p.timeout)
          pending.delete(resp.id)
          p.resolve(resp)
        }
      }
    } catch {
      // ignore malformed lines from stderr leaking into stdout
    }
  })

  const client: McpClient = {
    proc,

    call(method: string, params: Record<string, unknown> = {}): Promise<RpcResponse> {
      const id = idCounter++
      return new Promise<RpcResponse>((resolveOuter, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`MCP server did not respond to "${method}" within 5s`))
        }, 5000)
        const wrapped = {
          resolve: (resp: RpcResponse) => {
            // MCP-spec compliance (2026-05-25): tool-call responses now wrap
            // the tool's structured output as `{ content: [{ type: "text",
            // text: JSON.stringify(...) }] }`. Tests written against the old
            // "result IS the tool output" shape continue to work by
            // auto-unwrapping here. Non-tools/call methods (initialize,
            // tools/list, etc.) are returned untouched.
            if (method === 'tools/call' && resp.result && !resp.error) {
              const r = resp.result as { content?: Array<{ type: string; text: string }> }
              const block = r.content?.[0]
              if (block && block.type === 'text' && typeof block.text === 'string') {
                try {
                  const unwrapped = JSON.parse(block.text)
                  resp = { ...resp, result: unwrapped }
                } catch {
                  // If it isn't JSON, just leave the text as the result.
                  resp = { ...resp, result: block.text }
                }
              }
            }
            resolveOuter(resp)
          },
          reject,
          timeout,
        }
        pending.set(id, wrapped)
        proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      })
    },

    notify(method: string, params: Record<string, unknown> = {}): void {
      proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id: null, method, params }) + '\n')
    },

    close(): Promise<void> {
      rl.close()
      return new Promise((resolve) => {
        proc.once('exit', () => resolve())
        proc.stdin!.end()
      })
    },
  }

  await client.call('initialize', {})
  client.notify('notifications/initialized')

  return client
}
