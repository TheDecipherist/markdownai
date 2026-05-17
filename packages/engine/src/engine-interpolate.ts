import { execSync } from 'node:child_process'
import { resolve, relative } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import type { InterpolationSpan, ShellInlineSpan } from '@markdownai/parser'
import { resolveEnv, type EngineContext } from './context.js'
import { checkShellCommand } from './security/shell.js'
import type { ShellSecurityConfig } from './security/config.js'
import { formatDate } from './sources.js'

export function executeShellInline(command: string, ctx: EngineContext): string {
  if (!ctx.security.allowShell) {
    ctx.warnings.push(`Shell inline blocked (allowShell is false): \`${command}\``)
    return ''
  }
  const shellConfig: ShellSecurityConfig = ctx.security.shellConfig ?? {
    enabled: true,
    allow_patterns: [],
    deny_patterns: [],
    allow_network: false,
    require_confirmation: false,
    audit_log: false,
  }
  const check = checkShellCommand(command, shellConfig)
  if (!check.allowed) {
    ctx.warnings.push(`Shell inline blocked [${check.tier}]: ${check.reason}`)
    return ''
  }
  try {
    const out = execSync(command, { cwd: ctx.cwd, encoding: 'utf8', timeout: 10_000 })
    return out.trimEnd()
  } catch (err) {
    ctx.warnings.push(`Shell inline failed: \`${command}\` — ${String(err)}`)
    return ''
  }
}

export function evalExpr(expr: string, ctx: EngineContext): string {
  const trimmed = expr.trim()

  if (/^[A-Z_][A-Z0-9_]*$/.test(trimmed)) return resolveEnv(trimmed, null, ctx)

  const dateFmtMatch = trimmed.match(/^date\s+format="([^"]*)"$/)
  if (dateFmtMatch) return formatDate(new Date(), dateFmtMatch[1] ?? 'ISO')

  const envObj: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const jailRoot = ctx.security.jailRoot ?? ctx.docDir ?? null
  const fileHelper = {
    exists: (p: string): boolean => {
      const abs = jailRoot ? resolve(jailRoot, p) : p
      if (jailRoot && relative(jailRoot, abs).startsWith('..')) return false
      return existsSync(abs)
    },
    isFile: (p: string): boolean => {
      const abs = jailRoot ? resolve(jailRoot, p) : p
      if (jailRoot && relative(jailRoot, abs).startsWith('..')) return false
      try { return statSync(abs).isFile() } catch { return false }
    },
    isDir: (p: string): boolean => {
      const abs = jailRoot ? resolve(jailRoot, p) : p
      if (jailRoot && relative(jailRoot, abs).startsWith('..')) return false
      try { return statSync(abs).isDirectory() } catch { return false }
    },
  }
  try {
    const result = runInNewContext(trimmed, { ...envObj, env: envObj, file: fileHelper }, { timeout: 500 })
    return String(result ?? '')
  } catch {
    ctx.warnings.push(`Unresolvable expression: ${trimmed}`)
    return ''
  }
}

export function resolveInterpolations(
  text: string,
  spans: InterpolationSpan[],
  ctx: EngineContext,
  shellInlines: ShellInlineSpan[] = [],
): string {
  if (spans.length === 0 && shellInlines.length === 0) return text

  type AnySpan = { start: number; end: number; resolve: () => string }
  const all: AnySpan[] = [
    ...spans.map(s => ({ start: s.start, end: s.end, resolve: () => s.escaped ? `{{${s.expression}}}` : evalExpr(s.expression, ctx) })),
    ...shellInlines.map(s => ({ start: s.start, end: s.end, resolve: () => executeShellInline(s.command, ctx) })),
  ].sort((a, b) => a.start - b.start)

  let result = ''
  let pos = 0
  for (const span of all) {
    result += text.slice(pos, span.start)
    result += span.resolve()
    pos = span.end
  }
  return result + text.slice(pos)
}
