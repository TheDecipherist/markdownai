import { clearSessionCache, clearPersistCache } from '@markdownai/engine'
import { validateMcpInput } from '../validate.js'

export interface InvalidateCacheResult {
  cleared: { session: boolean; persist: boolean }
  error?: string
}

export function invalidateCache(directive?: string): InvalidateCacheResult {
  if (directive !== undefined) {
    const validation = validateMcpInput([{ field: 'directive', value: directive }])
    if (!validation.ok) {
      return { cleared: { session: false, persist: false }, error: validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ') }
    }
  }
  clearSessionCache()
  clearPersistCache(directive)
  return { cleared: { session: true, persist: true } }
}
