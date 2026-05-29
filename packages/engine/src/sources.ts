import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, isAbsolute, dirname } from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { ListNode, ReadNode, CountNode, DateNode, TreeNode, DbNode, HttpNode, QueryNode } from '@markdownai/parser'
import type { EngineContext } from './context.js'
import { parseQuery, DbParseError } from './db/query.js'
import { checkHttpUrl } from './security/http.js'
import { checkDataPath } from './security/filesystem.js'
import { checkDbOperation } from './security/database.js'
import { checkShellCommand } from './security/shell.js'
import { expandPattern } from './security/path-expand.js'
import { interpolatePathSoft } from './engine-include.js'
import type { HttpSecurityConfig } from './security/config.js'
import { globToRegex, walkDir, listJson, listCsv, readEnvFile } from './sources-file-utils.js'

/**
 * Resolve and security-check a data-op path. Returns the absolute path if
 * allowed, or null if blocked (with a SECURITY_ALERT warning already pushed).
 * v2.0: jails against dataJail (default: cwd), honors allowedDataPaths.
 */
function resolveDataPath(path: string, ctx: EngineContext, directive: string): string | null {
  const dataJail = ctx.security.dataJail ?? ctx.security.jailRoot ?? ctx.docDir
  if (!dataJail) {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} no data jail configured: ${path}`)
    return null
  }
  // Expand the path before resolving, mirroring @query (and the read-ops
  // fix). Without this, `${CLAUDE_SKILL_DIR}`, `${CWD}`, `${HOME}`, a leading
  // `~/`, and `{{ }}` interpolations stay literal in @list/@read/@count/@tree
  // paths — so a flow installed at ~/.claude/mdd2/ that lists its own skill
  // tree (`@list ${CLAUDE_SKILL_DIR}/flows`) silently matches nothing.
  const expandedPath = expandPattern(interpolatePathSoft(path, ctx), {
    env: { ...ctx.env, ...ctx.envFiles },
    skillDir: ctx.skillContext?.skillDir ?? '',
    sessionId: ctx.skillContext?.sessionId ?? '',
  })
  const full = isAbsolute(expandedPath) ? expandedPath : resolve(dataJail, expandedPath)
  const check = checkDataPath(full, dataJail, ctx.security.allowedDataPaths, ctx.security.filesystemConfig)
  if (check.level === 'blocked') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} path blocked — ${check.reason}: ${path}`)
    return null
  }
  if (check.level === 'alert') {
    ctx.warnings.push(`SECURITY_ALERT: ${directive} sensitive path accessed — ${check.reason}: ${path}`)
  }
  return full
}

export function executeList(node: ListNode, ctx: EngineContext): string[] {
  const full = resolveDataPath(node.path, ctx, '@list')
  if (!full) return []
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
  const full = resolveDataPath(node.path, ctx, '@read')
  if (!full) return []
  const ext = node.path.toLowerCase()
  if (ext.endsWith('.json')) return listJson(full, node.args)
  if (ext.endsWith('.csv')) return listCsv(full, node.args)
  if (ext.endsWith('.env')) return readEnvFile(full, node.args)
  try {
    return readFileSync(full, 'utf8').split('\n').filter(l => l !== '')
  } catch { return [] }
}

/**
 * Parse a wave/feature brief into labeled fields. A brief is a markdown
 * block whose paragraphs start with a bold label like `**Purpose.**` or
 * `**Definition of Done.**`. Each label opens a section; the next bold
 * label closes it.
 *
 * Returns a struct keyed by snake_case label name. The label "Definition
 * of Done" becomes `definition_of_done`. Trailing periods, leading/trailing
 * whitespace, and the original `**...**` markers are stripped from values.
 *
 * Used by Phase 3 of build flows to seed the feature-doc template's intent
 * fields (purpose, business_rules, definition_of_done) from the wave brief
 * the engine extracted via read_section — so the first draft is structured
 * rather than dumping the whole brief into a single field.
 */
export function parseFeatureBrief(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  const src = String(text ?? '')
  if (!src) return result
  // Match `**Label.**` (or `**Label (qualifier).**`) at line start. Capture
  // the label text inside the bold markers, strip trailing period before
  // snake_case-ing. Allow any non-bold content between matches.
  const LABEL_RE = /^\*\*([^*]+?)\*\*\s*/gm
  type Match = { label: string; start: number; bodyStart: number }
  const matches: Match[] = []
  let m: RegExpExecArray | null
  while ((m = LABEL_RE.exec(src)) !== null) {
    matches.push({ label: m[1] ?? '', start: m.index, bodyStart: m.index + m[0].length })
  }
  if (matches.length === 0) return result
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!
    const next = matches[i + 1]
    const end = next ? next.start : src.length
    const rawLabel = cur.label.trim().replace(/\.$/, '')
    const key = rawLabel
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    if (!key) continue
    const body = src.slice(cur.bodyStart, end).trim()
    result[key] = body
  }
  return result
}

/**
 * Pull backtick-wrapped file paths out of a markdown string. Used by build
 * Phase 3b to extract `src/foo.ts`-style paths from a wave brief's
 * **Source files.** paragraph (e.g. "`src/rules/parser.ts`,
 * `src/rules/loader.ts`, ..."). Only matches strings inside single backticks
 * that contain a dot followed by a 1-6 char alphabetic extension — avoids
 * picking up unrelated backtick spans like `@constraint id`. Returns each
 * matched path in source order.
 */
export function extractFilePaths(text: string): string[] {
  const src = String(text ?? '')
  if (!src) return []
  const matches = Array.from(src.matchAll(/`([^`\s]+\.[A-Za-z]{1,6})`/g))
  return matches.map(m => m[1] ?? '').filter(p => p.length > 0)
}

/**
 * Extract a markdown section by heading substring match. Given an absolute
 * file path and a needle, finds the first ATX heading whose text contains
 * the needle (case-insensitive) and returns that heading line plus body
 * up to the next heading at the same level or higher. Returns '' on miss.
 *
 * Used by the `read_section(path, heading_contains)` sandbox builtin so
 * flows can inline a single section of a wave/feature doc without Claude
 * touching the raw file. Matches headings #1 through #6.
 */
export function readMarkdownSection(absPath: string, headingContains: string): string {
  const needle = String(headingContains ?? '').trim().toLowerCase()
  if (!needle) return ''
  let content: string
  try { content = readFileSync(absPath, 'utf8') } catch { return '' }
  const lines = content.split('\n')
  let startIdx = -1
  let startLevel = 0
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i] ?? '')
    if (!m) continue
    const headingText = (m[2] ?? '').trim()
    if (headingText.toLowerCase().includes(needle)) {
      startIdx = i
      startLevel = (m[1] ?? '').length
      break
    }
  }
  if (startIdx === -1) return ''
  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s/.exec(lines[i] ?? '')
    if (m && (m[1] ?? '').length <= startLevel) {
      endIdx = i
      break
    }
  }
  return lines.slice(startIdx, endIdx).join('\n').trim()
}

export function formatDate(date: Date, fmt: string): string {
  if (fmt === 'ISO') return date.toISOString()
  if (fmt === 'date') return date.toISOString().split('T')[0] ?? ''
  const offMin = -date.getTimezoneOffset()
  const sign = offMin >= 0 ? '+' : '-'
  const offH = Math.floor(Math.abs(offMin) / 60).toString().padStart(2, '0')
  const offM = (Math.abs(offMin) % 60).toString().padStart(2, '0')
  const tzAbbr = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? 'UTC'
  const h12 = date.getHours() % 12 || 12
  const tokens: [string, string][] = [
    ['YYYY', String(date.getFullYear())],
    ['MM',   String(date.getMonth() + 1).padStart(2, '0')],
    ['DD',   String(date.getDate()).padStart(2, '0')],
    ['HH',   String(date.getHours()).padStart(2, '0')],
    ['hh',   String(h12).padStart(2, '0')],
    ['mm',   String(date.getMinutes()).padStart(2, '0')],
    ['ss',   String(date.getSeconds()).padStart(2, '0')],
    ['zzz',  tzAbbr],
    ['ZZ',   `${sign}${offH}${offM}`],
    ['Z',    `${sign}${offH}:${offM}`],
    ['A',    date.getHours() < 12 ? 'AM' : 'PM'],
    ['a',    date.getHours() < 12 ? 'am' : 'pm'],
    ['h',    String(h12)],
    ['z',    tzAbbr],
    ['X',    String(Math.floor(date.getTime() / 1000))],
    ['x',    String(date.getTime())],
  ]
  let result = fmt
  for (const [token, value] of tokens) result = result.split(token).join(value)
  return result
}

export function executeCount(node: CountNode, ctx: EngineContext): string[] {
  const full = resolveDataPath(node.path, ctx, '@count')
  if (!full) return ['0']
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
  if (type === 'modified' && filePath && ctx) {
    const abs = resolveDataPath(filePath, ctx, '@date file=')
    if (abs) {
      try { date = new Date(statSync(abs).mtime) } catch { /* fallback to now */ }
    }
  } else if (type === 'modified' && filePath) {
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
  const full = resolveDataPath(node.path, ctx, '@tree')
  if (!full) return []
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
    const mockFull = resolveDataPath(node.cache.mockPath, ctx, '@db mock')
    if (!mockFull) return []
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

  // Security check: validate the operation against db security rules
  if (ctx.security.dbConfig) {
    const connectionName = usingName ?? Object.keys(ctx.connections)[0] ?? 'default'
    const operationStr = parsed.kind === 'raw'
      ? parsed.query
      : `${parsed.plan.operation} ${parsed.plan.collection}`
    const dbCheck = checkDbOperation(operationStr, connectionName, ctx.security.dbConfig)
    if (!dbCheck.allowed) {
      const prefix = dbCheck.tier === 'always_block' ? 'SECURITY_ALERT' : 'WARN'
      ctx.warnings.push(`${prefix}: @db operation blocked [${dbCheck.tier}] — ${dbCheck.reason}`)
      return []
    }
  }

  if (parsed.kind === 'raw') {
    ctx.warnings.push('@db: raw query is read-only and not supported via the sync worker yet — use a structured `find=`/`one=`/`count=` query instead')
    return []
  }

  // Resolve the URI. Connection args take precedence over inline uri=. The
  // `env.VARNAME` form reads from process.env; literal strings pass through.
  const rawUri = (connection?.args['uri'] ?? uriArg ?? '').trim()
  if (!rawUri) {
    ctx.warnings.push('@db: connection has no uri= configured')
    return []
  }
  const uri = rawUri.startsWith('env.') ? (process.env[rawUri.slice(4)] ?? '') : rawUri
  if (!uri) {
    ctx.warnings.push(`@db: environment variable "${rawUri.slice(4)}" is empty or unset`)
    return []
  }

  const connType = connection?.type ?? 'mongodb'
  if (connType !== 'mongodb') {
    ctx.warnings.push(`@db: only mongodb is wired today (got "${connType}") — other adapters require finishing the sync worker`)
    return []
  }

  // Spawn the sync worker. The worker reads JSON from stdin, executes the
  // plan against MongoDB, and writes a JSON result envelope to stdout.
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'db', 'sync-worker.js')
  const payload = JSON.stringify({ type: connType, uri, plan: parsed.plan, timeoutMs: 5000 })
  const result = spawnSync(process.execPath, [workerPath], {
    input: payload,
    encoding: 'utf8',
    timeout: 10_000,  // outer timeout: worker's own 5s + slack for spawn + connect
  })
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    const stdout = (result.stdout ?? '').trim()
    let workerMsg = ''
    try {
      const parsed = JSON.parse(stdout) as { ok?: boolean; error?: string }
      if (parsed.error) workerMsg = parsed.error
    } catch { /* stdout not JSON; fall back to stderr */ }
    ctx.warnings.push(`@db: worker failed (exit ${result.status}) — ${workerMsg || stderr || 'no diagnostic output'}`)
    return []
  }
  let envelope: { ok: boolean; rows?: unknown[]; error?: string }
  try {
    envelope = JSON.parse((result.stdout ?? '').trim())
  } catch (err) {
    ctx.warnings.push(`@db: worker output not parseable as JSON — ${String(err)}`)
    return []
  }
  if (!envelope.ok) {
    ctx.warnings.push(`@db: worker error — ${envelope.error ?? 'unknown'}`)
    return []
  }
  const rows = Array.isArray(envelope.rows) ? envelope.rows : []
  // Stash the parsed rows on the node for the engine's label-capture path to
  // pick up (so as=row / as=json land as real objects in ctx.data, not just
  // JSON strings in ctx.envFiles). The engine reads node.__dbRows after
  // executeSource returns to do struct-capture.
  ;(node as DbNode & { __dbRows?: unknown[] }).__dbRows = rows
  // Return one line per row's JSON for the existing line-based label/path.
  return rows.map(r => JSON.stringify(r))
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
    const mockFull = resolveDataPath(node.cache.mockPath, ctx, '@http mock')
    if (!mockFull) return []
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
    const mockFull = resolveDataPath(node.cache.mockPath, ctx, '@query mock')
    if (!mockFull) return []
    try { return readFileSync(mockFull, 'utf8').split('\n').filter(l => l !== '') }
    catch { return [] }
  }

  if (!node.command) { ctx.warnings.push('@query: empty command — skipped'); return [] }

  // Resolve {{ expr }} interpolations and ${VAR} expansions in the command
  // string before checking security + executing. Without this, flows that
  // use `@query "ls *{{ feature_slug }}*"` would run literal "{{ }}" text
  // as a shell glob (no match, silent miss). interpolatePathSoft handles
  // the {{ }}; expandPattern handles ${CWD}/${HOME}/${VAR}.
  const interpolated = interpolatePathSoft(node.command, ctx)
  const command = expandPattern(interpolated, {
    env: { ...ctx.env, ...ctx.envFiles },
    skillDir: ctx.skillContext?.skillDir ?? '',
    sessionId: ctx.skillContext?.sessionId ?? '',
  })

  if (ctx.security.shellConfig) {
    const shellCheck = checkShellCommand(command, ctx.security.shellConfig)
    if (!shellCheck.allowed) {
      const prefix = shellCheck.tier === 'always_block' ? 'SECURITY_ALERT' : 'WARN'
      const cmdPreview = command.length > 80 ? command.slice(0, 77) + '...' : command
      ctx.warnings.push(`${prefix}: @query command blocked [${shellCheck.tier}] — ${shellCheck.reason}: \`${cmdPreview}\``)
      return []
    }
  }

  try {
    const out = execSync(command, { cwd: ctx.cwd, encoding: 'utf8', timeout: 10_000 })
    return out.split('\n').filter(l => l !== '')
  } catch {
    ctx.warnings.push(`@query: command failed — "${command}"`)
    return []
  }
}
