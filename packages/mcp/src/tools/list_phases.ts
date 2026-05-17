import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode, TransitionNode } from '@markdownai/parser'

export interface PhaseInfo {
  name: string
  transitions: Array<{ event: string; action: { type: string; name: string } }>
}

export interface ListPhasesResult {
  phases: PhaseInfo[]
  error?: string
}

function isRelativeAndWithinCwd(filePath: string, cwd: string): boolean {
  if (isAbsolute(filePath)) return false
  const rel = relative(cwd, resolve(cwd, filePath))
  return !rel.startsWith('..')
}

export function listPhases(filePath: string, cwd: string): ListPhasesResult {
  if (!filePath) return { phases: [], error: 'filePath must not be empty' }
  if (!cwd) return { phases: [], error: 'cwd must not be empty' }
  if (!isRelativeAndWithinCwd(filePath, cwd)) {
    return { phases: [], error: `Path traversal blocked: "${filePath}"` }
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
