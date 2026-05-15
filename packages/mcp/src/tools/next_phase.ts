import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'

export interface NextPhaseResult {
  phase: string | null
  found: boolean
}

export function nextPhase(filePath: string, currentPhase: string, cwd: string): NextPhaseResult {
  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return { phase: null, found: false } }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { phase: null, found: false }

  for (const node of ast.nodes) {
    if (node.type !== 'phase') continue
    const phase = node as PhaseNode
    if (phase.name !== currentPhase) continue
    // Find @on complete -> @phase transition
    for (const t of phase.transitions) {
      if (t.event === 'complete' && t.action.type === 'phase') {
        return { phase: t.action.name, found: true }
      }
    }
    return { phase: null, found: true }  // phase exists but no next
  }
  return { phase: null, found: false }
}
