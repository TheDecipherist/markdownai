import { readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'
import { checkFilePath, checkAbsolutePath } from '@markdownai/engine'

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
  const check = isAbsolute(filePath) ? checkAbsolutePath(filePath) : checkFilePath(filePath, cwd)
  if (check.level === 'blocked') return { phases: [], errors: [`Path blocked: ${check.reason}`], exitCode: 1 }
  const resolved = resolve(cwd, filePath)
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
        target: 'name' in t.action ? t.action.name : '',
        type: t.action.type,
      })),
    })
  }
  return { phases, errors: [], exitCode: 0 }
}
