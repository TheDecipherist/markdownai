// Variable expansion for security path patterns.
// Resolves ${VAR} placeholders at check-time so user config can reference
// runtime values like ${CLAUDE_SKILL_DIR} without baking them in.

import { homedir } from 'node:os'

export interface PatternExpandContext {
  env: Record<string, string>          // process.env + envFiles
  skillDir?: string                    // CLAUDE_SKILL_DIR
  sessionId?: string                   // CLAUDE_SESSION_ID
}

const VAR_RE = /\$\{([A-Z_][A-Z0-9_]*)\}/gi

/**
 * Expand ${VAR} references in a single pattern string. Supported variables:
 *
 *   ${HOME}                — current user's home directory
 *   ${CLAUDE_SKILL_DIR}    — skill directory (when set)
 *   ${CLAUDE_SESSION_ID}   — Claude Code session id
 *   ${<env var name>}      — any process env / loaded env-file variable
 *
 * Unresolved variables expand to the empty string. Patterns with empty-string
 * substitutions usually no longer match anything safely (e.g. "${UNSET}/file"
 * becomes "/file"), which is the conservative outcome.
 */
export function expandPattern(pattern: string, ctx: PatternExpandContext): string {
  return pattern.replace(VAR_RE, (_, name: string) => {
    const upper = name.toUpperCase()
    if (upper === 'HOME') return homedir()
    if (upper === 'CLAUDE_SKILL_DIR' && ctx.skillDir) return ctx.skillDir
    if (upper === 'CLAUDE_SESSION_ID' && ctx.sessionId) return ctx.sessionId
    return ctx.env[name] ?? ctx.env[upper] ?? ''
  })
}

/**
 * Expand an array of patterns. Empty results (from fully-unresolved patterns)
 * are dropped to avoid matching by accident.
 */
export function expandPatterns(patterns: string[], ctx: PatternExpandContext): string[] {
  return patterns
    .map(p => expandPattern(p, ctx))
    .filter(p => p.length > 0)
}
