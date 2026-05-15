import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode, TransitionNode } from '@markdownai/parser'

export interface PhaseInfo {
  name: string
  transitions: Array<{ event: string; action: { type: string; name: string } }>
}

export function listPhases(filePath: string, cwd: string): PhaseInfo[] {
  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return [] }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return []

  const phases: PhaseInfo[] = []
  for (const node of ast.nodes) {
    if (node.type === 'phase') {
      const phase = node as PhaseNode
      phases.push({
        name: phase.name,
        transitions: (phase.transitions as TransitionNode[]).map(t => ({
          event: t.event,
          action: { type: t.action.type, name: t.action.name },
        })),
      })
    }
  }
  return phases
}
