import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'
import { checkFilePath } from '@markdownai/engine'
import { validateMcpInput } from '../validate.js'

export interface NextPhaseResult {
  phase: string | null
  found: boolean
  error?: string
}

export function nextPhase(filePath: string, currentPhase: string, cwd: string): NextPhaseResult {
  const validation = validateMcpInput([
    { field: 'filePath', value: filePath, noPathInjection: true },
    { field: 'currentPhase', value: currentPhase },
    { field: 'cwd', value: cwd, noPathInjection: true },
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
