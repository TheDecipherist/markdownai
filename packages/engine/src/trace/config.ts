export type TraceConfig =
  | { sink: 'stderr' }
  | { sink: 'file'; path: string }
  | { sink: 'http'; url: string }

export function parseTraceConfig(value: string | undefined): TraceConfig | null {
  if (!value) return null
  const v = value.trim()
  if (v === 'true' || v === '1' || v === 'stderr') return { sink: 'stderr' }
  if (v.startsWith('file:')) {
    const path = v.slice(5)
    if (!path) {
      process.stderr.write('MARKDOWNAI_TRACE warning: file sink requires a path (e.g. file:/tmp/trace.jsonl) — tracing disabled\n')
      return null
    }
    return { sink: 'file', path }
  }
  if (v.startsWith('http://') || v.startsWith('https://')) {
    return { sink: 'http', url: v }
  }
  process.stderr.write(`MARKDOWNAI_TRACE warning: unrecognized sink value "${v}" — tracing disabled\n`)
  return null
}
