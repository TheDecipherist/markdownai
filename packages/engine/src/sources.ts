import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { execSync } from 'node:child_process'
import type { ListNode, ReadNode, CountNode, DateNode, TreeNode, DbNode, HttpNode, QueryNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'

function globToRegex(pattern: string): RegExp {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00/g, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${re}$`)
}

function walkDir(dir: string, rel: string, matchRe: RegExp | null, typeFilter: string, depth: number, maxDepth: number): string[] {
  if (maxDepth >= 0 && depth > maxDepth) return []
  let names: string[]
  try { names = readdirSync(dir) } catch { return [] }
  const results: string[] = []
  for (const name of names) {
    const full = join(dir, name)
    const entRel = rel ? `${rel}/${name}` : name
    let isDir = false
    try { isDir = statSync(full).isDirectory() } catch { continue }
    const matches = !matchRe || matchRe.test(entRel)
    if (!isDir && typeFilter !== 'dirs' && matches) results.push(entRel)
    if (isDir && typeFilter !== 'files' && matches) results.push(entRel)
    if (isDir) results.push(...walkDir(full, entRel, matchRe, typeFilter, depth + 1, maxDepth))
  }
  return results
}

function whereMatches(row: Record<string, unknown>, expr: string): boolean {
  try { return Boolean(runInNewContext(expr, { ...row }, { timeout: 500 })) } catch { return false }
}

function rowToTabLine(row: Record<string, unknown>, columns: string[] | null, collapse: boolean): string {
  const keys = columns ?? Object.keys(row)
  return keys.map(k => {
    const v = row[k]
    return collapse && v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
  }).join('\t')
}

function getAtPath(obj: unknown, path: string): unknown {
  // Supports dot-notation and [n] array indices: "users[0].name"
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  return tokens.reduce((cur, key) => {
    if (cur === null || cur === undefined) return undefined
    if (Array.isArray(cur)) { const i = parseInt(key, 10); return isNaN(i) ? undefined : cur[i] }
    if (typeof cur === 'object') return (cur as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

function listJson(fullPath: string, args: Record<string, string | undefined>): string[] {
  let raw: string
  try { raw = readFileSync(fullPath, 'utf8') } catch { return [] }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }

  const target = args['path'] ? getAtPath(parsed, args['path']) : parsed
  const colSpec = args['columns']
  const cols = colSpec ? colSpec.split(',').map(c => (c.includes(':') ? c.split(':')[0]! : c).trim()) : null
  const collapse = args['collapse'] === 'true'
  const whereExpr = args['where']

  if (Array.isArray(target)) {
    return (target as unknown[])
      .map(item => (item !== null && typeof item === 'object' ? item as Record<string, unknown> : { value: item }))
      .filter(row => !whereExpr || whereMatches(row, whereExpr))
      .map(row => rowToTabLine(row, cols, collapse))
  }

  if (target !== null && typeof target === 'object') {
    const obj = target as Record<string, unknown>
    const mode = args['mode'] ?? 'keys'
    if (mode === 'values') return Object.values(obj).map(v => String(v ?? ''))
    if (mode === 'entries') return Object.entries(obj).map(([k, v]) => `${k}\t${String(v ?? '')}`)
    return Object.keys(obj)
  }

  return [String(target ?? '')]
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (inQuote) {
      if (ch === '"') inQuote = false
      else cur += ch
    } else if (ch === '"') {
      inQuote = true
    } else if (ch === ',') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

function listCsv(fullPath: string, args: Record<string, string | undefined>): string[] {
  let raw: string
  try { raw = readFileSync(fullPath, 'utf8') } catch { return [] }
  const allLines = raw.split('\n').filter(l => l.trim())
  const skipN = parseInt(args['skip'] ?? '0', 10)
  const lines = allLines.slice(skipN)
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0] ?? '')
  const singleCol = args['column']
  const colSpec = args['columns']
  const selectedCols = colSpec ? colSpec.split(',').map(c => c.trim()) : headers
  const whereExpr = args['where']

  const rows = lines.slice(1)
    .map(l => {
      const cells = parseCsvLine(l)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
      return row
    })
    .filter(row => !whereExpr || whereMatches(row, whereExpr))

  if (singleCol) return rows.map(row => row[singleCol] ?? '')
  return rows.map(row => selectedCols.map(c => row[c] ?? '').join('\t'))
}

function readEnvFile(fullPath: string, args: Record<string, string | undefined>): string[] {
  if (args['path'] !== undefined) return ['ERROR: use key= for .env files, not path=']
  let raw: string
  try { raw = readFileSync(fullPath, 'utf8') } catch { return [] }
  const pairs: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    let v = trimmed.slice(eqIdx + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    pairs[k] = v
  }
  const key = args['key']
  if (key) return pairs[key] !== undefined ? [pairs[key]!] : []
  return Object.entries(pairs).map(([k, v]) => `${k}=${v}`)
}

export function executeList(node: ListNode, ctx: EngineContext): string[] {
  const full = resolve(ctx.docDir, node.path)
  const ext = node.path.toLowerCase()

  if (ext.endsWith('.json')) return listJson(full, node.args)
  if (ext.endsWith('.csv')) return listCsv(full, node.args)

  const matchPattern = node.args['match']
  const matchRe = matchPattern ? globToRegex(matchPattern) : null
  const typeFilter = node.args['type'] ?? 'files'
  const depthStr = node.args['depth']
  const maxDepth = depthStr !== undefined ? parseInt(depthStr, 10) : -1
  const base = node.path.replace(/\/$/, '')
  return walkDir(full, '', matchRe, typeFilter, 0, maxDepth).map(r => `${base}/${r}`)
}

export function executeRead(node: ReadNode, ctx: EngineContext): string[] {
  const full = resolve(ctx.docDir, node.path)
  const ext = node.path.toLowerCase()
  if (ext.endsWith('.json')) return listJson(full, node.args)
  if (ext.endsWith('.csv')) return listCsv(full, node.args)
  if (ext.endsWith('.env')) return readEnvFile(full, node.args)
  try {
    return readFileSync(full, 'utf8').split('\n').filter(l => l !== '')
  } catch { return [] }
}

export function formatDate(date: Date, fmt: string): string {
  if (fmt === 'ISO') return date.toISOString()
  if (fmt === 'date') return date.toISOString().split('T')[0] ?? ''
  return fmt
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
    .replace('DD', String(date.getDate()).padStart(2, '0'))
    .replace('HH', String(date.getHours()).padStart(2, '0'))
    .replace('mm', String(date.getMinutes()).padStart(2, '0'))
    .replace('ss', String(date.getSeconds()).padStart(2, '0'))
}

export function executeCount(node: CountNode, ctx: EngineContext): string[] {
  try {
    const full = resolve(ctx.docDir, node.path)
    const st = statSync(full)
    if (st.isDirectory()) {
      const matchPattern = node.args['match']
      const matchRe = matchPattern ? globToRegex(matchPattern) : null
      const typeFilter = node.args['type'] ?? 'files'
      return [String(walkDir(full, '', matchRe, typeFilter, 0, -1).length)]
    }
    return [String(readFileSync(full, 'utf8').split('\n').length)]
  } catch { return ['0'] }
}

export function executeDate(node: DateNode): string[] {
  const fmt = node.args['format'] ?? 'ISO'
  const filePath = node.args['file']
  const type = node.args['type'] ?? 'current'
  let date = new Date()
  if (type === 'modified' && filePath) {
    try { date = new Date(statSync(filePath).mtime) } catch { /* fallback to now */ }
  }
  return [formatDate(date, fmt)]
}

export function buildTree(dir: string, prefix: string, matchRe: RegExp | null, depth: number, maxDepth: number): string[] {
  if (maxDepth >= 0 && depth > maxDepth) return []
  let entries: import('node:fs').Dirent[]
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const lines: string[] = []
  entries.forEach((entry, i) => {
    if (matchRe && !entry.isDirectory() && !matchRe.test(entry.name)) return
    const isLast = i === entries.length - 1
    lines.push(prefix + (isLast ? '└── ' : '├── ') + entry.name)
    if (entry.isDirectory()) {
      lines.push(...buildTree(join(dir, entry.name), prefix + (isLast ? '    ' : '│   '), matchRe, depth + 1, maxDepth))
    }
  })
  return lines
}

export function executeTree(node: TreeNode, ctx: EngineContext): string[] {
  const full = resolve(ctx.docDir, node.path)
  const matchPattern = node.args['match']
  const matchRe = matchPattern ? globToRegex(matchPattern) : null
  const depthStr = node.args['depth']
  const maxDepth = depthStr !== undefined ? parseInt(depthStr, 10) : -1
  return buildTree(full, '', matchRe, 0, maxDepth)
}

export function executeDb(node: DbNode, ctx: EngineContext): string[] {
  if (!ctx.security.allowDb) return []  // jailed: stripped silently

  // Mock cache: serve from file, no real DB needed
  if (node.cache?.mode === 'mock' && node.cache.mockPath) {
    const mockFull = resolve(ctx.docDir, node.cache.mockPath)
    return listCsv(mockFull, node.args)
  }

  // Resolve connection: named > inline > single-defined
  const usingName = node.args['using']
  const connection = usingName
    ? ctx.connections[usingName]
    : Object.values(ctx.connections)[0]
  const uriArg = node.args['uri']

  if (!connection && !uriArg) {
    ctx.warnings.push('@db: no connection resolvable — use @connect or provide uri=env.VAR')
    return []
  }

  ctx.warnings.push('@db: database query execution requires a configured driver')
  return []
}

// Cloud metadata endpoints — always blocked, immutable security rule
const BLOCKED_HOSTS = ['169.254.169.254', 'metadata.google.internal', 'fd00:ec2::254', '100.100.100.200']

function isBlockedHost(url: string): boolean {
  try { return BLOCKED_HOSTS.some(h => new URL(url).hostname.includes(h)) } catch { return false }
}

export function executeHttp(node: HttpNode, ctx: EngineContext): string[] {
  if (!ctx.security.allowHttp) return []  // jailed: stripped silently

  const url = node.args['url'] ?? ''
  if (!url) { ctx.warnings.push('@http: url= is required'); return [] }

  // Cloud metadata endpoints always blocked — immutable rule
  if (isBlockedHost(url)) {
    ctx.warnings.push(`SECURITY_ALERT: @http blocked — cloud metadata endpoint: ${url}`)
    return []
  }

  // Mock cache: serve from local file without network
  if (node.cache?.mode === 'mock' && node.cache.mockPath) {
    const mockFull = resolve(ctx.docDir, node.cache.mockPath)
    const ext = node.cache.mockPath.toLowerCase()
    if (ext.endsWith('.csv')) return listCsv(mockFull, node.args)
    return listJson(mockFull, node.args)
  }

  ctx.warnings.push('@http: live requests require async rendering — use @cache mock for development')
  return []
}

export function executeQuery(node: QueryNode, ctx: EngineContext): string[] {
  if (!ctx.security.allowShell) return []  // jailed: stripped silently

  // Mock cache: serve from local file without spawning a process
  if (node.cache?.mode === 'mock' && node.cache.mockPath) {
    try { return readFileSync(resolve(ctx.docDir, node.cache.mockPath), 'utf8').split('\n').filter(l => l !== '') }
    catch { return [] }
  }

  if (!node.command) { ctx.warnings.push('@query: empty command — skipped'); return [] }

  try {
    const out = execSync(node.command, { cwd: ctx.cwd, encoding: 'utf8', timeout: 10_000 })
    return out.split('\n').filter(l => l !== '')
  } catch {
    ctx.warnings.push(`@query: command failed — "${node.command}"`)
    return []
  }
}
