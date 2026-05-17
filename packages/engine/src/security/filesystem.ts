import { homedir } from 'node:os'
import { resolve, relative, isAbsolute, basename } from 'node:path'
import type { FilesystemSecurityConfig } from './config.js'
import {
  FILESYSTEM_ALWAYS_BLOCK_PATHS, FILESYSTEM_ALWAYS_BLOCK_PATTERNS,
  FILESYSTEM_ALWAYS_ALERT_PATTERNS, matchGlob,
} from './rules.js'

export type FilesystemCheckLevel = 'allowed' | 'alert' | 'blocked'

export interface FilesystemCheckResult {
  level: FilesystemCheckLevel
  reason: string
}

function expandHome(p: string): string {
  if (!p.startsWith('~')) return p
  // ~/ or ~ alone → current user's home
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) return homedir() + p.slice(1)
  // ~username/... → treat as blocked (can't resolve without getpwnam; fall through to block patterns)
  return p
}

export function checkFilePath(
  filePath: string,
  docRoot: string,
  config?: FilesystemSecurityConfig
): FilesystemCheckResult {
  // 1. Absolute paths always blocked
  if (isAbsolute(filePath)) {
    return { level: 'blocked', reason: 'Absolute paths are not permitted' }
  }

  // 2. Traversal above document root
  const full = resolve(docRoot, filePath)
  const rel = relative(docRoot, full)
  if (rel.startsWith('..')) {
    return { level: 'blocked', reason: 'Path traversal above document root is not permitted' }
  }

  const name = basename(filePath)
  const expandedFull = expandHome(full)

  // 3. Built-in always_block_paths (absolute path patterns)
  for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATHS) {
    const expanded = expandHome(pattern)
    if (matchGlob(expanded, expandedFull)) {
      return { level: 'blocked', reason: `Built-in blocked path: ${pattern}` }
    }
  }

  // 4. Filename matches built-in always_block_patterns
  for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATTERNS) {
    if (matchGlob(pattern, name)) {
      return { level: 'blocked', reason: `Built-in blocked file pattern: ${pattern}` }
    }
  }

  // 5. User additional_block_paths
  if (config?.additional_block_paths?.length) {
    for (const pattern of config.additional_block_paths) {
      if (matchGlob(expandHome(pattern), expandedFull)) {
        return { level: 'blocked', reason: `User blocked path: ${pattern}` }
      }
    }
  }

  // 6. User additional_block_patterns (filename)
  if (config?.additional_block_patterns?.length) {
    for (const pattern of config.additional_block_patterns) {
      if (matchGlob(pattern, name)) {
        return { level: 'blocked', reason: `User blocked file pattern: ${pattern}` }
      }
    }
  }

  // 7. Always_alert_patterns → allowed but notice required
  for (const pattern of FILESYSTEM_ALWAYS_ALERT_PATTERNS) {
    if (matchGlob(pattern, name)) {
      return { level: 'alert', reason: `Sensitive file type accessed: ${pattern}` }
    }
  }

  return { level: 'allowed', reason: '' }
}
