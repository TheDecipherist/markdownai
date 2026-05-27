// Synchronous-from-the-engine MongoDB worker.
//
// The markdownai engine renders synchronously (spawnSync everywhere). The
// MongoDB driver is inherently async. This worker bridges them: the engine
// spawnSync's `node <this-file>`, pipes a JSON config via stdin, blocks
// until the worker prints a result JSON to stdout and exits. One process
// per @db call (cached by @cache session / persist for repeats).
//
// Read-only by design. Write directives (insert/update/delete) deliberately
// not wired here — those go through the MDD CLI / MCP layer instead, so
// markdownai never mutates project state.
//
// Stdin payload shape:
//   { type: 'mongodb', uri: string, plan: QueryPlan, timeoutMs?: number }
//
// Stdout response shape:
//   { ok: true, rows: Row[] }
//   { ok: false, error: string }

import { MongoDbAdapter } from './adapters/mongodb.js'
import type { QueryPlan, Row } from './query.js'

interface WorkerRequest {
  type: 'mongodb'
  uri: string
  plan: QueryPlan
  timeoutMs?: number
}

interface WorkerResponseOk {
  ok: true
  rows: Row[]
}

interface WorkerResponseErr {
  ok: false
  error: string
}

type WorkerResponse = WorkerResponseOk | WorkerResponseErr

const WRITE_OPERATIONS = new Set(['insert', 'update', 'delete', 'replace', 'drop'])

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function writeResponse(resp: WorkerResponse): void {
  process.stdout.write(JSON.stringify(resp))
  process.stdout.write('\n')
}

async function main(): Promise<void> {
  let req: WorkerRequest
  try {
    const raw = await readStdin()
    req = JSON.parse(raw) as WorkerRequest
  } catch (err) {
    writeResponse({ ok: false, error: `worker: invalid input — ${String(err)}` })
    process.exit(1)
  }

  if (req.type !== 'mongodb') {
    writeResponse({ ok: false, error: `worker: unsupported adapter type "${req.type}" — only mongodb is wired today` })
    process.exit(1)
  }

  // Block write operations defensively. The MDD layer owns mutations.
  if (WRITE_OPERATIONS.has(req.plan.operation as string)) {
    writeResponse({ ok: false, error: `worker: write operation "${req.plan.operation}" rejected — @db is read-only; mutations go through MDD CLI/MCP` })
    process.exit(1)
  }

  const adapter = new MongoDbAdapter()
  const timeoutMs = req.timeoutMs && req.timeoutMs > 0 ? req.timeoutMs : 5000

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`worker: query timed out after ${timeoutMs}ms`)), timeoutMs).unref()
  })

  try {
    await Promise.race([adapter.connect(req.uri), timeoutPromise])
    const rows = await Promise.race([adapter.execute(req.plan), timeoutPromise])
    writeResponse({ ok: true, rows })
    process.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeResponse({ ok: false, error: message })
    process.exit(1)
  } finally {
    try { await adapter.disconnect() } catch { /* ignore */ }
  }
}

main().catch(err => {
  writeResponse({ ok: false, error: `worker: uncaught — ${String(err)}` })
  process.exit(1)
})
