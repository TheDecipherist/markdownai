import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'
import { execute, checkFilePath, loadSecurityConfig } from '@markdownai/engine'
import { validateMcpInput } from '../validate.js'
import { buildSkillContext, type SkillArgsInput } from '../skill-context.js'

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
  const result = execute(ast, {
    filePath: full,
    ctx: {
      cwd,
      envFiles: {},
      phase: currentPhase,
      consumer: 'ai',
      skillContext: buildSkillContext(args),
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

  if (result.chosenTransition?.phaseTarget) {
    return { phase: result.chosenTransition.phaseTarget, found: true }
  }
  for (const t of phaseNode.transitions) {
    if (t.event === 'complete' && t.action.type === 'phase') {
      return { phase: t.action.name, found: true }
    }
  }
  return { phase: null, found: true }
}
