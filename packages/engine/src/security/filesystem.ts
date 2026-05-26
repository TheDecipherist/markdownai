import { homedir } from 'node:os'
import { resolve, relative, isAbsolute, basename } from 'node:path'
import type { FilesystemSecurityConfig } from './config.js'
import {
  FILESYSTEM_ALWAYS_ALLOW_PATHS,
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
  // 0. Absolute paths under a built-in safe root (MarkdownAI / MDD / Claude
  //    system dirs) are explicitly allowed — block list below still applies
  //    inside them so sensitive filenames (.env, *.pem) stay blocked.
  if (isAbsolute(filePath)) {
    const expandedFull = expandHome(filePath)
    let inSafeRoot = false
    for (const pattern of FILESYSTEM_ALWAYS_ALLOW_PATHS) {
      if (matchGlob(pattern, expandedFull)) { inSafeRoot = true; break }
    }
    if (!inSafeRoot) {
      return { level: 'blocked', reason: 'Absolute paths are not permitted (not in a built-in safe root)' }
    }
    // Inside a safe root: still consult built-in block patterns (sensitive filenames).
    const name = basename(filePath)
    for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATHS) {
      if (matchGlob(expandHome(pattern), expandedFull)) {
        return { level: 'blocked', reason: `Built-in blocked path: ${pattern}` }
      }
    }
    for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATTERNS) {
      if (matchGlob(pattern, name)) {
        return { level: 'blocked', reason: `Built-in blocked file pattern: ${pattern}` }
      }
    }
    return { level: 'allowed', reason: '' }
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

/**
 * v2.0: Check a source-op path (@import / @include).
 *
 * Allowed when:
 *   - path is relative and resolves inside sourceJail, OR
 *   - path (relative or absolute) matches a pattern in allowedSourcePaths.
 *
 * Built-in immutable rules (FILESYSTEM_ALWAYS_BLOCK_*) and user-configured
 * additional_block_* always apply regardless of allowlists.
 */
export function checkSourcePath(
  filePath: string,
  sourceJail: string,
  allowedSourcePaths: string[] | undefined,
  config?: FilesystemSecurityConfig
): FilesystemCheckResult {
  return checkJailedPath(filePath, sourceJail, allowedSourcePaths, config, 'source')
}

/**
 * v2.0: Check a data-op path (@list / @read / @tree / @count / file.*).
 *
 * Allowed when:
 *   - path is relative and resolves inside dataJail, OR
 *   - path (relative or absolute) matches a pattern in allowedDataPaths.
 *
 * Built-in immutable rules and user-configured additional_block_* always apply.
 */
export function checkDataPath(
  filePath: string,
  dataJail: string,
  allowedDataPaths: string[] | undefined,
  config?: FilesystemSecurityConfig
): FilesystemCheckResult {
  return checkJailedPath(filePath, dataJail, allowedDataPaths, config, 'data')
}

function checkJailedPath(
  filePath: string,
  jailRoot: string,
  allowedPaths: string[] | undefined,
  config: FilesystemSecurityConfig | undefined,
  opType: 'source' | 'data'
): FilesystemCheckResult {
  // 1. Resolve to absolute path. Relative paths anchor on the jail; absolute
  //    stay as-is so they can be checked against allowlists.
  const absolute = isAbsolute(filePath) ? filePath : resolve(jailRoot, filePath)
  const expandedAbs = expandHome(absolute)
  const name = basename(absolute)

  // 2. Always_block_paths and patterns are immutable — apply first so allowlists
  //    cannot bypass them.
  for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATHS) {
    if (matchGlob(expandHome(pattern), expandedAbs)) {
      return { level: 'blocked', reason: `Built-in blocked path: ${pattern}` }
    }
  }
  for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATTERNS) {
    if (matchGlob(pattern, name)) {
      return { level: 'blocked', reason: `Built-in blocked file pattern: ${pattern}` }
    }
  }
  if (config?.additional_block_paths?.length) {
    for (const pattern of config.additional_block_paths) {
      if (matchGlob(expandHome(pattern), expandedAbs)) {
        return { level: 'blocked', reason: `User blocked path: ${pattern}` }
      }
    }
  }
  if (config?.additional_block_patterns?.length) {
    for (const pattern of config.additional_block_patterns) {
      if (matchGlob(pattern, name)) {
        return { level: 'blocked', reason: `User blocked file pattern: ${pattern}` }
      }
    }
  }

  // 3. Inside the jail? Allowed (subject to alert check below).
  const rel = relative(jailRoot, absolute)
  const insideJail = !rel.startsWith('..') && !isAbsolute(rel)
  if (insideJail) {
    return classifyAlert(name, opType)
  }

  // 3b. Outside the jail but under a built-in safe root (MarkdownAI / MDD /
  //     Claude system dirs)? Allowed. This is what lets flow files at
  //     ~/.claude/mdd2/flows/ @import macros at ~/.claude/mdd2/macros/
  //     without each project having to configure allowed_source_paths.
  for (const pattern of FILESYSTEM_ALWAYS_ALLOW_PATHS) {
    if (matchGlob(pattern, expandedAbs)) {
      return classifyAlert(name, opType)
    }
  }

  // 4. Outside the jail — only allowed if it matches an allowlist pattern.
  if (allowedPaths && allowedPaths.length > 0) {
    for (const pattern of allowedPaths) {
      const expandedPattern = expandHome(pattern)
      if (matchGlob(expandedPattern, expandedAbs)) {
        return classifyAlert(name, opType)
      }
    }
  }

  return {
    level: 'blocked',
    reason: opType === 'source'
      ? `Path outside source root (sourceJail=${jailRoot}); add to filesystem.allowed_source_paths to permit`
      : `Path outside data root (dataJail=${jailRoot}); add to filesystem.allowed_data_paths to permit`,
  }
}

/**
 * v2.0: Check a write-op destination path (@mkdir, @copy to=, @append-if-missing).
 *
 * Requires `filesystem.write_enabled: true` in the security config.
 *
 * Allowed when:
 *   - path is inside writeRoot, OR
 *   - path matches a pattern in allowedWritePaths
 *
 * Immutable rules apply: `.env`, `**\/.ssh/**`, credentials, etc. cannot be written
 * to even with a wide allow-list.
 */
export function checkWritePath(
  filePath: string,
  writeRoot: string,
  allowedWritePaths: string[] | undefined,
  config?: FilesystemSecurityConfig
): FilesystemCheckResult {
  return checkJailedPath(filePath, writeRoot, allowedWritePaths, config, 'data')
}

function classifyAlert(name: string, _opType: 'source' | 'data'): FilesystemCheckResult {
  for (const pattern of FILESYSTEM_ALWAYS_ALERT_PATTERNS) {
    if (matchGlob(pattern, name)) {
      return { level: 'alert', reason: `Sensitive file type accessed: ${pattern}` }
    }
  }
  return { level: 'allowed', reason: '' }
}

/**
 * Check an absolute path against built-in always_block rules only.
 * Use this for paths that are legitimately absolute (e.g. CLI entry-point args)
 * where blocking all absolute paths would break normal usage, but sensitive
 * system paths must still be rejected.
 */
export function checkAbsolutePath(
  filePath: string,
  config?: FilesystemSecurityConfig
): FilesystemCheckResult {
  const expandedFull = expandHome(filePath)
  const name = basename(filePath)

  for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATHS) {
    if (matchGlob(expandHome(pattern), expandedFull)) {
      return { level: 'blocked', reason: `Built-in blocked path: ${pattern}` }
    }
  }
  for (const pattern of FILESYSTEM_ALWAYS_BLOCK_PATTERNS) {
    if (matchGlob(pattern, name)) {
      return { level: 'blocked', reason: `Built-in blocked file pattern: ${pattern}` }
    }
  }
  if (config?.additional_block_paths?.length) {
    for (const pattern of config.additional_block_paths) {
      if (matchGlob(expandHome(pattern), expandedFull)) {
        return { level: 'blocked', reason: `User blocked path: ${pattern}` }
      }
    }
  }
  if (config?.additional_block_patterns?.length) {
    for (const pattern of config.additional_block_patterns) {
      if (matchGlob(pattern, name)) {
        return { level: 'blocked', reason: `User blocked file pattern: ${pattern}` }
      }
    }
  }
  return { level: 'allowed', reason: '' }
}
