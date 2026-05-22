export interface TraceSpan {
  id: string
  runId: string
  ast: 'markdownai' | 'markdown' | 'header'
  directive?: string
  status: 'start' | 'end' | 'error'
  timestamp: number
  startedAt: number
  endedAt?: number
  duration?: number
  document: string
  line: number
  phase: string | null
  callstack: string[]
  args: Record<string, string>
  outputSize?: number
  error?: string
  git: { hash: string; short: string } | null
  sessionId: string | null
}

export function extractArgs(node: Record<string, unknown>): Record<string, string> {
  const picks = ['name', 'path', 'url', 'command', 'transport', 'query', 'operation', 'fallback', 'source', 'format', 'key', 'version']
  const result: Record<string, string> = {}
  // Spread node.args first (user-supplied key-value pairs on nodes like @call, @connect, @http)
  const nodeArgs = node['args']
  if (nodeArgs !== null && typeof nodeArgs === 'object' && !Array.isArray(nodeArgs)) {
    for (const [k, v] of Object.entries(nodeArgs as Record<string, unknown>)) {
      if (typeof v === 'string') result[k] = v
    }
  }
  // Overlay named top-level picks (these take precedence)
  for (const key of picks) {
    const val = node[key]
    if (typeof val === 'string' && val !== '') result[key] = val
  }
  return result
}
