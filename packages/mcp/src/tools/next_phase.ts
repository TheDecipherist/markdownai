import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'

export interface NextPhaseResult {
  phase: string | null
  found: boolean
  error?: string
}

function isConfined(filePath: string, cwd: string): boolean {
  if (isAbsolute(filePath)) return false
  const rel = relative(cwd, resolve(cwd, filePath))
  return !rel.startsWith('..')
}

export function nextPhase(filePath: string, currentPhase: string, cwd: string): NextPhaseResult {
  if (!isConfined(filePath, cwd)) {
    return { phase: null, found: false, error: `Path traversal blocked: "${filePath}"` }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return { phase: null, found: false } }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { phase: null, found: false }

  for (const node of ast.nodes) {
    if (node.type !== 'phase') continue
    const phase = node as PhaseNode
    if (phase.name !== currentPhase) continue
    for (const t of phase.transitions) {
      if (t.event === 'complete' && t.action.type === 'phase') {
        return { phase: t.action.name, found: true }
      }
    }
    return { phase: null, found: true }  // phase exists but no next
  }
  return { phase: null, found: false }
}
