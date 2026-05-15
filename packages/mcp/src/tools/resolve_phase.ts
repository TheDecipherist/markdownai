import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

export interface ResolvePhaseResult {
  content: string
  warnings: string[]
  found: boolean
}

export function resolvePhase(
  filePath: string,
  phase: string,
  cwd: string,
  env?: Record<string, string>
): ResolvePhaseResult {
  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch {
    return { content: '', warnings: [`Cannot read file: ${filePath}`], found: false }
  }

  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return { content: '', warnings: [], found: false }

  const phaseExists = ast.nodes.some(n => n.type === 'phase' && (n as { name: string }).name === phase)
  if (!phaseExists) return { content: '', warnings: [`Phase not found: ${phase}`], found: false }

  const result = execute(ast, { filePath: full, ctx: { envFiles: env ?? {}, phase } })
  return { content: result.output, warnings: result.warnings, found: true }
}
