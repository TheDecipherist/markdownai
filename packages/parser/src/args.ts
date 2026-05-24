import type { CacheConfig } from './types.js'

export interface ParsedArgs {
  positional: string[]
  named: Record<string, string>
  local: boolean
  condition: string | null
  cache: CacheConfig | null
}

function tokenize(str: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inDoubleQuote = false
  let inSingleQuote = false
  let doubleBraceDepth = 0

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]!
    const next = str[i + 1]
    if (inDoubleQuote) {
      current += ch
      if (ch === '"') inDoubleQuote = false
    } else if (inSingleQuote) {
      current += ch
      if (ch === "'") inSingleQuote = false
    } else if (doubleBraceDepth > 0) {
      current += ch
      if (ch === '}' && next === '}') { doubleBraceDepth--; current += '}'; i++ }
      else if (ch === '{' && next === '{') { doubleBraceDepth++; current += '{'; i++ }
    } else if (ch === '{' && next === '{') {
      doubleBraceDepth++
      current += '{{'
      i++
    } else if (ch === '"') {
      inDoubleQuote = true
      current += ch
    } else if (ch === "'") {
      inSingleQuote = true
      current += ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

function unquote(val: string): string {
  if (val.length >= 2) {
    if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1)
    if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1)
  }
  return val
}

function parseCacheTokens(tokens: string[]): CacheConfig {
  let mode: 'session' | 'persist' | 'mock' = 'session'
  let ttl: number | undefined
  let mockPath: string | undefined

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i]
    if (!tok) continue
    if (tok === 'session') { mode = 'session' }
    else if (tok === 'persist') { mode = 'persist' }
    else if (tok.startsWith('ttl=')) { const n = parseInt(tok.slice(4), 10); if (!isNaN(n)) ttl = n }
    else if (tok.startsWith('mock=')) { mode = 'mock'; mockPath = tok.slice(5) }
  }

  const cfg: CacheConfig = { mode }
  if (ttl !== undefined) cfg.ttl = ttl
  if (mockPath !== undefined) cfg.mockPath = mockPath
  return cfg
}

function isNamedArg(token: string): boolean {
  if (token.startsWith('"') || token.startsWith("'")) return false
  const eq = token.indexOf('=')
  if (eq <= 0) return false
  const key = token.slice(0, eq)
  // Must not be a path-like string before the =
  return !/^[./~]/.test(key)
}

export function parseArgs(raw: string): ParsedArgs {
  const all = tokenize(raw.trim())

  // Extract @cache (everything from @cache token to end)
  const cacheIdx = all.indexOf('@cache')
  const cacheTokens = cacheIdx !== -1 ? all.slice(cacheIdx) : []
  const preCache = cacheIdx !== -1 ? all.slice(0, cacheIdx) : all

  // Extract @local (last token in preCache)
  const local = preCache.length > 0 && preCache[preCache.length - 1] === '@local'
  const preLocal = local ? preCache.slice(0, -1) : preCache

  // Extract `if` condition (first standalone 'if' token)
  const ifIdx = preLocal.indexOf('if')
  const condition = ifIdx !== -1 ? preLocal.slice(ifIdx + 1).join(' ') : null
  const mainTokens = ifIdx !== -1 ? preLocal.slice(0, ifIdx) : preLocal

  const positional: string[] = []
  const named: Record<string, string> = {}

  for (const tok of mainTokens) {
    if (isNamedArg(tok)) {
      const eq = tok.indexOf('=')
      named[tok.slice(0, eq)] = unquote(tok.slice(eq + 1))
    } else {
      positional.push(unquote(tok))
    }
  }

  const cache = cacheTokens.length > 0 ? parseCacheTokens(cacheTokens) : null
  return { positional, named, local, condition, cache }
}
