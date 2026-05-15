import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CacheConfig } from '@markdownai/parser'

interface PersistEntry {
  value: string
  expires: number
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

export function writeCache(key: string, value: string, config: CacheConfig): void {
  if (config.mode === 'session') {
    SESSION_CACHE.set(key, value)
  } else if (config.mode === 'persist') {
    const ttlMs = (config.ttl ?? 3600) * 1000
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(join(CACHE_DIR, key + '.json'), JSON.stringify({ value, expires: Date.now() + ttlMs }))
  }
}
