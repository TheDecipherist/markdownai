import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode, TransitionNode } from '@markdownai/parser'
import { checkFilePath } from '@markdownai/engine'
import { validateMcpInput } from '../validate.js'

export interface PhaseInfo {
  name: string
  transitions: Array<{ event: string; action: { type: string; name: string } }>
}

export interface ListPhasesResult {
  phases: PhaseInfo[]
  error?: string
}

export function listPhases(filePath: string, cwd: string): ListPhasesResult {
  const validation = validateMcpInput([
    { field: 'filePath', value: filePath, noPathInjection: true },
    { field: 'cwd', value: cwd, noPathInjection: true },
  ])
  if (!validation.ok) return { phases: [], error: validation.errors.map(e => `${e.field}: ${e.reason}`).join('; ') }
  if (!filePath) return { phases: [], error: 'filePath must not be empty' }
  if (!cwd) return { phases: [], error: 'cwd must not be empty' }
  const check = checkFilePath(filePath, cwd)
  if (check.level === 'blocked') {
    return { phases: [], error: `Path traversal blocked: "${filePath}" — ${check.reason}` }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch (err) { return { phases: [], error: String(err) } }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { phases: [] }

  const phases: PhaseInfo[] = []
  for (const node of ast.nodes) {
    if (node.type !== 'phase') continue
    const phase = node as PhaseNode
    phases.push({
      name: phase.name,
      transitions: (phase.transitions as TransitionNode[]).map(t => ({
        event: t.event,
        action: { type: t.action.type, name: t.action.name },
      })),
    })
  }
  return { phases }
}
