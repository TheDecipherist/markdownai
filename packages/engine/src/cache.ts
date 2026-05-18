import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CacheConfig } from '@markdownai/parser'
import { applyMasking } from './security/masking.js'
import type { FilesystemSecurityConfig } from './security/config.js'

interface PersistEntry {
  value: string
  expires: number
  directive?: string
}

const SESSION_CACHE = new Map<string, string>()
const CACHE_DIR = join(homedir(), '.markdownai', 'cache')

export function cacheKey(directiveType: string, options: Record<string, unknown>): string {
  const sorted = Object.fromEntries(
    Object.entries(options).sort(([a], [b]) => a.localeCompare(b))
  )
  return createHash('sha256')
    .update(directiveType + ':' + JSON.stringify(sorted))
    .digest('hex')
}

export function readCache(key: string, config: CacheConfig): string | null {
  if (config.mode === 'mock') {
    if (!config.mockPath) return null
    try { return readFileSync(config.mockPath, 'utf8') } catch { return null }
  }
  if (config.mode === 'session') return SESSION_CACHE.get(key) ?? null
  if (config.mode === 'persist') {
    const path = join(CACHE_DIR, key + '.json')
    if (!existsSync(path)) return null
    try {
      const entry = JSON.parse(readFileSync(path, 'utf8')) as PersistEntry
      if (Date.now() > entry.expires) return null
      return entry.value
    } catch { return null }
  }
  return null
}

export function writeCache(
  key: string,
  value: string,
  config: CacheConfig,
  securityConfig?: FilesystemSecurityConfig,
  directiveType?: string
): void {
  const { masked } = applyMasking(value, securityConfig)
  if (config.mode === 'session') {
    SESSION_CACHE.set(key, masked)
  } else if (config.mode === 'persist') {
    const ttlMs = (config.ttl ?? 3600) * 1000
    mkdirSync(CACHE_DIR, { recursive: true })
    const entry: PersistEntry = { value: masked, expires: Date.now() + ttlMs }
    if (directiveType) entry.directive = directiveType
    writeFileSync(join(CACHE_DIR, key + '.json'), JSON.stringify(entry))
  }
}

export function clearSessionCache(): void {
  SESSION_CACHE.clear()
}

export function clearPersistCache(directiveType?: string): void {
  try {
    const files = readdirSync(CACHE_DIR)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const path = join(CACHE_DIR, file)
      if (directiveType) {
        try {
          const entry = JSON.parse(readFileSync(path, 'utf8')) as { directive?: string }
          if (entry.directive !== directiveType) continue
        } catch { continue }
      }
      try { unlinkSync(path) } catch (err) {
        process.stderr.write(`[markdownai] cache: failed to delete ${path}: ${String(err)}\n`)
      }
    }
  } catch { /* cache dir may not exist — not an error */ }
}

export interface CacheEntry {
  key: string
  mode: 'session' | 'persist'
  expired?: boolean
  size?: number
}

export function showCacheEntries(mode?: 'session' | 'persist'): CacheEntry[] {
  const entries: CacheEntry[] = []
  if (!mode || mode === 'session') {
    for (const key of SESSION_CACHE.keys()) {
      entries.push({ key, mode: 'session' })
    }
  }
  if (!mode || mode === 'persist') {
    try {
      const files = readdirSync(CACHE_DIR)
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const path = join(CACHE_DIR, file)
        try {
          const raw = readFileSync(path, 'utf8')
          const entry = JSON.parse(raw) as PersistEntry
          const expired = Date.now() > entry.expires
          const size = statSync(path).size
          entries.push({ key: file.replace('.json', ''), mode: 'persist', expired, size })
        } catch { /* skip malformed cache entry */ }
      }
    } catch { /* cache dir may not exist — not an error */ }
  }
  return entries
}
