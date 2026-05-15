import { clearSessionCache, clearPersistCache } from '@markdownai/engine'

export interface InvalidateCacheResult {
  cleared: { session: boolean; persist: boolean }
}

export function invalidateCache(directive?: string): InvalidateCacheResult {
  clearSessionCache()
  clearPersistCache(directive)
  return { cleared: { session: true, persist: true } }
}
