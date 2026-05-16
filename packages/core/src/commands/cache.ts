import { clearSessionCache, clearPersistCache, showCacheEntries } from '@markdownai/engine'
import type { CacheEntry } from '@markdownai/engine'

export interface CacheShowOptions {
  mode?: 'session' | 'persist'
  expired?: boolean
}

export interface CacheClearOptions {
  session?: boolean
  persist?: boolean
  directive?: string
}

export interface CacheShowResult {
  entries: CacheEntry[]
}

export interface CacheClearResult {
  cleared: { session: boolean; persist: boolean }
  count: number
}

export function runCacheShow(options: CacheShowOptions = {}): CacheShowResult {
  let entries = showCacheEntries(options.mode)
  if (options.expired !== undefined) {
    entries = entries.filter(e => e.expired === options.expired)
  }
  return { entries }
}

export function runCacheClear(options: CacheClearOptions = {}): CacheClearResult {
  // When neither flag is set, clear both. When one is explicitly true, clear only that one.
  const clearSess = !options.persist || Boolean(options.session)
  const clearPers = !options.session || Boolean(options.persist)

  if (clearSess) clearSessionCache()
  if (clearPers) clearPersistCache(options.directive)

  return {
    cleared: { session: clearSess, persist: clearPers },
    count: 0,  // exact count not tracked — operation is best-effort
  }
}
