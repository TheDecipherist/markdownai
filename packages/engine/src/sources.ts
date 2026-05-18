import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execSync } from 'node:child_process'
import type { ListNode, ReadNode, CountNode, DateNode, TreeNode, DbNode, HttpNode, QueryNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { parseQuery, DbParseError } from './db/query.js'
import { checkHttpUrl } from './security/http.js'
import type { HttpSecurityConfig } from './security/config.js'
import { globToRegex, walkDir, listJson, listCsv, readEnvFile } from './sources-file-utils.js'

function checkJailRoot(full: string, ctx: EngineContext): boolean {
  const jailRoot = ctx.security.jailRoot
  if (!jailRoot) return true
  const rel = full.startsWith(jailRoot) ? full.slice(jailRoot.length) : null
  return rel !== null && !rel.startsWith('..') && (rel === '' || rel.startsWith('/') || rel.startsWith('\\'))
}

export function executeList(node: ListNode, ctx: EngineContext): string[] {
  const full = resolve(ctx.docDir, node.path)
  if (!checkJailRoot(full, ctx)) {
    ctx.warnings.push(`SECURITY_ALERT: @list path confined — access denied: ${node.path}`)
    return []
  }
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
  if (!checkJailRoot(full, ctx)) {
    ctx.warnings.push(`SECURITY_ALERT: @read path confined — access denied: ${node.path}`)
    return []
  }
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
  const full = resolve(ctx.docDir, node.path)
  if (!checkJailRoot(full, ctx)) {
    ctx.warnings.push(`SECURITY_ALERT: @count path confined — access denied: ${node.path}`)
    return ['0']
  }
  try {
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

export function executeDate(node: DateNode, ctx?: EngineContext): string[] {
  const fmt = node.args['format'] ?? 'ISO'
  const filePath = node.args['file']
  const type = node.args['type'] ?? 'current'
  if (type === 'created') {
    throw new Error('@date: type="created" is not supported — file creation time is not reliably available across platforms')
  }
  let date = new Date()
  if (type === 'modified' && filePath) {
    const jailRoot = ctx?.security.jailRoot
    if (jailRoot) {
      const abs = resolve(jailRoot, filePath)
      if (!abs.startsWith(jailRoot)) {
        ctx?.warnings.push(`SECURITY_ALERT: @date file= path confined — access denied: ${filePath}`)
      } else {
        try { date = new Date(statSync(abs).mtime) } catch { /* fallback to now */ }
      }
    } else {
      try { date = new Date(statSync(filePath).mtime) } catch { /* fallback to now */ }
    }
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

  // Parse and validate the directive (throws DbParseError on malformed input)
  let parsed
  try {
    parsed = parseQuery(node.args, ctx.env)
  } catch (err) {
    if (err instanceof DbParseError) throw new Error(`@db parse error: ${err.message}`)
    throw err
  }

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

  // Async DB execution is not available in the synchronous render path — use @cache mock= for development
  if (parsed.kind === 'raw') {
    ctx.warnings.push('@db: raw query requires async execution — use @cache mock= for development or call via MCP')
    return []
  }

  ctx.warnings.push('@db: database query requires async execution — use @cache mock= for development or call via MCP')
  return []
}

// Permissive fallback used when no httpConfig is loaded — only immutable rules apply
const PERMISSIVE_HTTP_CONFIG: HttpSecurityConfig = Object.freeze({
  enabled: true,
  allowed_domains: [],
  denied_domains: [],
  allowed_methods: ['GET'],
  max_response_size: 1_048_576,
  timeout: 10_000,
})

export function executeHttp(node: HttpNode, ctx: EngineContext): string[] {
  if (!ctx.security.allowHttp) return []  // jailed: stripped silently

  const url = node.args['url'] ?? ''
  if (!url) { ctx.warnings.push('@http: url= is required'); return [] }

  const method = (node.args['method'] ?? 'GET').toUpperCase()
  const check = checkHttpUrl(url, ctx.security.httpConfig ?? PERMISSIVE_HTTP_CONFIG, method)
  if (!check.allowed) {
    const prefix = check.tier === 'always_block' ? 'SECURITY_ALERT' : 'WARN'
    ctx.warnings.push(`${prefix}: @http blocked [${check.tier}] — ${check.reason}`)
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
