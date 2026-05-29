// Single source of truth for jailed, security-checked filesystem reads used by
// every interpolation/condition path (engine-interpolate.ts, conditions.ts) and
// referenced by read-side directives (read-ops.ts). Keeping one implementation
// guarantees `@if`, `{{ }}` body interpolation, `@foreach` bodies, and the
// read directives all confine to the same data jail and expose the same helper
// surface — no drift between paths, identical behavior in the MCP and the CLI.

import { existsSync, statSync, readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import type { EngineContext } from './context.js'
import type { FilesystemSecurityConfig } from './security/config.js'
import { checkDataPath } from './security/filesystem.js'
import { readFrontmatterField } from './frontmatter-utils.js'
import { readMarkdownSection } from './sources.js'

/**
 * The data jail for read helpers: explicit `dataJail`, else the legacy
 * `jailRoot`, else the document directory. One definition for all callers.
 */
export function resolveDataJail(ctx: EngineContext): string | null {
  return ctx.security.dataJail ?? ctx.security.jailRoot ?? ctx.docDir ?? null
}

export interface FileHelpers {
  exists: (p: string) => boolean
  isFile: (p: string) => boolean
  isDir: (p: string) => boolean
  containsLine: (p: string, pattern: string) => boolean
  frontmatterField: (p: string, field: string) => string
  readSection: (p: string, headingContains: string) => string
  containsSection: (p: string, heading: string) => boolean
}

/**
 * Build the jailed file-access helpers. A path that fails the security check
 * (outside the jail, blocked pattern) resolves to null and every helper returns
 * a safe empty/false value.
 */
export function makeFileHelpers(
  dataJail: string | null,
  allowedDataPaths: string[] | undefined,
  fsConfig: FilesystemSecurityConfig | undefined,
): FileHelpers {
  function confined(p: string): string | null {
    if (!dataJail) return null
    const check = checkDataPath(p, dataJail, allowedDataPaths, fsConfig)
    if (check.level === 'blocked') return null
    return isAbsolute(p) ? p : resolve(dataJail, p)
  }
  return {
    exists: (p: string): boolean => {
      const abs = confined(p)
      return abs !== null ? existsSync(abs) : false
    },
    isFile: (p: string): boolean => {
      const abs = confined(p)
      if (abs === null) return false
      try {
        return statSync(abs).isFile()
      } catch {
        return false
      }
    },
    isDir: (p: string): boolean => {
      const abs = confined(p)
      if (abs === null) return false
      try {
        return statSync(abs).isDirectory()
      } catch {
        return false
      }
    },
    containsLine: (p: string, pattern: string): boolean => {
      const abs = confined(p)
      if (abs === null || !existsSync(abs)) return false
      try {
        const content = readFileSync(abs, 'utf8')
        const re = new RegExp(pattern, 'm')
        return re.test(content)
      } catch {
        return false
      }
    },
    frontmatterField: (p: string, field: string): string => {
      const abs = confined(p)
      if (abs === null || !existsSync(abs)) return ''
      try {
        const content = readFileSync(abs, 'utf8')
        return readFrontmatterField(content, field) ?? ''
      } catch {
        return ''
      }
    },
    readSection: (p: string, headingContains: string): string => {
      const abs = confined(p)
      if (abs === null) return ''
      return readMarkdownSection(abs, headingContains)
    },
    containsSection: (p: string, heading: string): boolean => {
      const abs = confined(p)
      if (abs === null || !existsSync(abs)) return false
      try {
        const content = readFileSync(abs, 'utf8')
        const normalized = heading.trim()
        if (/^#+\s/.test(normalized)) {
          const re = new RegExp(
            '^' + normalized.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*$',
            'm',
          )
          return re.test(content)
        }
        const re = new RegExp(
          '^#{1,6}\\s+' + normalized.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*$',
          'm',
        )
        return re.test(content)
      } catch {
        return false
      }
    },
  }
}
