import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import type { PhaseNode } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

export interface ResolvePhaseResult {
  content: string
  warnings: string[]
  found: boolean
  error?: string
}

function isConfined(filePath: string, cwd: string): boolean {
  if (isAbsolute(filePath)) return false
  const rel = relative(cwd, resolve(cwd, filePath))
  return !rel.startsWith('..')
}

function isPhaseNode(n: unknown): n is PhaseNode {
  return typeof n === 'object' && n !== null && (n as Record<string, unknown>)['type'] === 'phase'
}

export function resolvePhase(
  filePath: string,
  phase: string,
  cwd: string,
  env?: Record<string, string>
): ResolvePhaseResult {
  if (!isConfined(filePath, cwd)) {
    return { content: '', warnings: [], found: false, error: `Path traversal blocked: "${filePath}"` }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch {
    return { content: '', warnings: [`Cannot read file: ${filePath}`], found: false }
  }

  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { content: '', warnings: [], found: false }

  const phaseExists = ast.nodes.some(n => isPhaseNode(n) && n.name === phase)
  if (!phaseExists) return { content: '', warnings: [`Phase not found: ${phase}`], found: false }

  const result = execute(ast, { filePath: full, ctx: { envFiles: env ?? {}, phase } })
  return { content: result.output, warnings: result.warnings, found: true }
}
