import { startServer } from '@markdownai/mcp'

export interface ServeOptions {
  cwd?: string
}

export interface ServeResult {
  started: boolean
  message: string
}

export function runServe(options: ServeOptions = {}): ServeResult {
  startServer(options.cwd ? { cwd: options.cwd } : {})
  return { started: true, message: 'MCP server started on stdio' }
}
