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
  for (const key of picks) {
    const val = node[key]
    if (typeof val === 'string' && val !== '') result[key] = val
  }
  return result
}
