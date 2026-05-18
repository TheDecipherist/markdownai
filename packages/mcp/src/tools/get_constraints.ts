import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import type { ConstraintNode } from '@markdownai/parser'

export interface ConstraintEntry {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  body: string
}

export interface GetConstraintsResult {
  constraints: ConstraintEntry[]
  isMarkdownAI: boolean
  blocked?: boolean
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function isConfined(filePath: string, cwd: string): boolean {
  if (isAbsolute(filePath)) return false
  const rel = relative(cwd, resolve(cwd, filePath))
  return !rel.startsWith('..')
}

function collectConstraints(nodes: import('@markdownai/parser').ASTNode[]): ConstraintEntry[] {
  const result: ConstraintEntry[] = []
  for (const node of nodes) {
    if (node.type === 'constraint') {
      const c = node as ConstraintNode
      result.push({ id: c.id, severity: c.severity, body: c.body })
    } else if ('body' in node && Array.isArray((node as { body: unknown }).body)) {
      result.push(...collectConstraints((node as { body: import('@markdownai/parser').ASTNode[] }).body))
    }
  }
  return result
}

export function getConstraints(filePath: string, cwd: string): GetConstraintsResult {
  if (!isConfined(filePath, cwd)) {
    return { constraints: [], isMarkdownAI: false, blocked: true }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch {
    return { constraints: [], isMarkdownAI: false }
  }

  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { constraints: [], isMarkdownAI: false }

  const constraints = collectConstraints(ast.nodes)
  constraints.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))

  return { constraints, isMarkdownAI: true }
}
