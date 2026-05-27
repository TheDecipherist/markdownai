import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'
import { execute, checkFilePath, loadSecurityConfig } from '@markdownai/engine'
import { validateMcpInput } from '../validate.js'
import { buildSkillContext, type SkillArgsInput } from '../skill-context.js'
import { loadSession, saveSession, clearSession } from '../session-state.js'

export interface NextPhaseArgs extends SkillArgsInput {
  filePath: string
  currentPhase: string
}

export interface NextPhaseResult {
  phase: string | null
  found: boolean
  error?: string
}

function isPhaseNode(n: unknown): n is PhaseNode {
  return typeof n === 'object' && n !== null && (n as Record<string, unknown>)['type'] === 'phase'
}

export function nextPhase(args: NextPhaseArgs, cwd: string): NextPhaseResult {
  const { filePath, currentPhase } = args
  const validation = validateMcpInput([
    { field: 'filePath', value: filePath, noPathInjection: true },
    { field: 'currentPhase', value: currentPhase },
    { field: 'cwd', value: cwd, noPathInjection: true },
    { field: 'skillArgs', value: args.skillArgs, optional: true },
  ])
  if (!validation.ok) return { phase: null, found: false, error: validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ') }
  const check = checkFilePath(filePath, cwd)
  if (check.level === 'blocked') {
    return { phase: null, found: false, error: `Path traversal blocked: "${filePath}" — ${check.reason}` }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch (err) { return { phase: null, found: false, error: String(err) } }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { phase: null, found: false }

  const phaseNode = ast.nodes.find((n): n is PhaseNode => isPhaseNode(n) && n.name === currentPhase)
  if (!phaseNode) return { phase: null, found: false }

  // Render the phase with skill context so any @if/@switch around @on complete
  // resolves correctly. The engine records the chosen transition; we surface
  // it as the next phase. Falls back to the first static transition declared
  // on the phase node (covers phases with a single unconditional @on complete).
  const sec = loadSecurityConfig()
  const fsForSkill: import('@markdownai/engine').FilesystemSecurityConfig = {
    ...sec.filesystem,
    source_root: 'auto',
    data_root: 'cwd',
  }
  const skillCtx = buildSkillContext(args)
  const session = loadSession(skillCtx.sessionId, full)
  const result = execute(ast, {
    filePath: full,
    ctx: {
      cwd,
      data: session?.data ?? {},
      envFiles: session?.envFiles ?? {},
      phase: currentPhase,
      consumer: 'ai',
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
  saveSession(skillCtx.sessionId, full, result.data, result.envFiles)

  let next: string | null = null
  if (result.chosenTransition?.phaseTarget) {
    next = result.chosenTransition.phaseTarget
  } else {
    for (const t of phaseNode.transitions) {
      if (t.event === 'complete' && t.action.type === 'phase') {
        next = t.action.name
        break
      }
    }
  }
  // Flow terminated → release the session so a re-run of the same flow
  // (or a different one in the same Claude session) starts with a clean
  // scope. Per the spec: scope lives for the duration of one flow.
  if (next === null && skillCtx.sessionId) clearSession(skillCtx.sessionId, full)
  return { phase: next, found: true }
}
