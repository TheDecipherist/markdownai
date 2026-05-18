import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'

export function globToRegex(pattern: string): RegExp {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00/g, '.*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${re}$`)
}

export function walkDir(dir: string, rel: string, matchRe: RegExp | null, typeFilter: string, depth: number, maxDepth: number): string[] {
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

export function whereMatches(row: Record<string, unknown>, expr: string): boolean {
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
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  return tokens.reduce((cur, key) => {
    if (cur === null || cur === undefined) return undefined
    if (Array.isArray(cur)) { const i = parseInt(key, 10); return isNaN(i) ? undefined : cur[i] }
    if (typeof cur === 'object') return (cur as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

export function listJson(fullPath: string, args: Record<string, string | undefined>): string[] {
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

export function listCsv(fullPath: string, args: Record<string, string | undefined>): string[] {
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

export function readEnvFile(fullPath: string, args: Record<string, string | undefined>): string[] {
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
