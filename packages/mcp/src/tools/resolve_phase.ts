import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'
import { execute, checkFilePath, loadSecurityConfig } from '@markdownai/engine'
import { validateMcpInput, validateEnvRecord } from '../validate.js'
import { buildSkillContext, type SkillArgsInput } from '../skill-context.js'
import { loadSession, saveSession } from '../session-state.js'

export interface ResolvePhaseArgs extends SkillArgsInput {
  filePath: string
  phase: string
  env?: Record<string, string>
  consumer?: string
}

export interface ResolvePhaseResult {
  content: string
  warnings: string[]
  found: boolean
  /** Phase target of the @on complete transition that fired during render, if any. */
  nextPhase?: string | null
  error?: string
}

function isPhaseNode(n: unknown): n is PhaseNode {
  return typeof n === 'object' && n !== null && (n as Record<string, unknown>)['type'] === 'phase'
}

export function resolvePhase(args: ResolvePhaseArgs, cwd: string): ResolvePhaseResult {
  const { filePath, phase, env, consumer } = args
  const validation = validateMcpInput([
    { field: 'filePath', value: filePath, noPathInjection: true },
    { field: 'phase', value: phase },
    { field: 'cwd', value: cwd, noPathInjection: true },
    { field: 'skillArgs', value: args.skillArgs, optional: true },
    { field: 'skillDir', value: args.skillDir, optional: true },
    { field: 'skillSessionId', value: args.skillSessionId, optional: true },
    { field: 'skillEffort', value: args.skillEffort, optional: true },
  ])
  if (!validation.ok) return { content: '', warnings: [], found: false, error: validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ') }
  const envErrors = validateEnvRecord(env)
  if (envErrors.length > 0) return { content: '', warnings: [], found: false, error: envErrors.map(e => `${e.field}: ${e.reason}`).join('; ') }
  const check = checkFilePath(filePath, cwd)
  if (check.level === 'blocked') {
    return { content: '', warnings: [], found: false, error: `Path traversal blocked: "${filePath}" — ${check.reason}` }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch {
    return { content: '', warnings: [`Cannot read file: ${filePath}`], found: false }
  }

  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { content: '', warnings: [], found: false }

  const phaseExists = ast.nodes.some(n => isPhaseNode(n) && n.name === phase)
  if (!phaseExists) return { content: '', warnings: [`Phase not found: ${phase}`], found: false }

  // MCP/skill mode: data ops jail to the user's project (cwd); source ops to
  // the document directory. Matches read_file's filesystem treatment.
  const sec = loadSecurityConfig()
  const fsForSkill: import('@markdownai/engine').FilesystemSecurityConfig = {
    ...sec.filesystem,
    source_root: 'auto',
    data_root: 'cwd',
  }
  const skillCtx = buildSkillContext(args)
  // Cross-call closure: load any @set values bound in earlier resolve_phase
  // calls for this (session × document) pair. Seeds the engine's ctx so this
  // phase can read variables defined upstream without re-deriving them.
  // Scope is per-document: switching to a different .md file gets a fresh
  // state, matching "one flow = one md walk" semantics.
  const session = loadSession(skillCtx.sessionId, full)
  const seedData = session?.data ?? {}
  const seedEnvFiles = session ? { ...session.envFiles, ...(env ?? {}) } : (env ?? {})
  const result = execute(ast, {
    filePath: full,
    ctx: {
      cwd,
      data: seedData,
      envFiles: seedEnvFiles,
      phase,
      consumer: consumer ?? 'ai',
      skillContext: skillCtx,
      security: {
        allowShell: sec.shell.enabled,
        allowHttp: sec.http.enabled,
        allowDb: Object.keys(sec.db).length > 0,
        jailRoot: null,
        filesystemConfig: fsForSkill,
        shellConfig: sec.shell,
      },
    },
  })
  // Capture the post-execute scope back into the session so the next
  // resolve_phase call inherits it. No-op when sessionId is empty (e.g.
  // standalone tool tests with no Claude session).
  saveSession(skillCtx.sessionId, full, result.data, result.envFiles)
  return {
    content: result.output,
    warnings: result.warnings,
    found: true,
    nextPhase: result.chosenTransition?.phaseTarget ?? null,
  }
}
