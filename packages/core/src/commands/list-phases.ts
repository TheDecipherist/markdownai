import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'

export interface PhaseEntry {
  name: string
  line: number
  transitions: Array<{ event: string; target: string; type: string }>
}

export interface ListPhasesResult {
  phases: PhaseEntry[]
  errors: string[]
  exitCode: number
}

export function runListPhases(filePath: string, options: { cwd?: string } = {}): ListPhasesResult {
  const cwd = options.cwd ?? process.cwd()
  const resolved = resolve(cwd, filePath)
  if (relative(cwd, resolved).startsWith('..')) {
    return { phases: [], errors: [`Path traversal blocked: ${filePath}`], exitCode: 1 }
  }
  let source: string
  try { source = readFileSync(resolved, 'utf8') } catch {
    return { phases: [], errors: [`Cannot read file: ${filePath}`], exitCode: 1 }
  }

  const ast = parse(source, { filePath: resolved })
  if (!ast.isMarkdownAI) return { phases: [], errors: ['Not a MarkdownAI document'], exitCode: 1 }

  const phases: PhaseEntry[] = []
  for (const node of ast.nodes) {
    if (node.type !== 'phase') continue
    const phase = node as PhaseNode
    phases.push({
      name: phase.name,
      line: phase.line,
      transitions: phase.transitions.map(t => ({
        event: t.event,
        target: t.action.name,
        type: t.action.type,
      })),
    })
  }
  return { phases, errors: [], exitCode: 0 }
}
