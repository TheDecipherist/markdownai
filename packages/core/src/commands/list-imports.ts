import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parse } from '@markdownai/parser'
import type { IncludeNode, ImportNode } from '@markdownai/parser'

export interface ImportEntry {
  path: string
  type: 'include' | 'import'
  line: number
  resolved: string
}

export interface ListImportsResult {
  imports: ImportEntry[]
  errors: string[]
  exitCode: number
}

function collectImports(
  filePath: string,
  docDir: string,
  visited: Set<string>,
  results: ImportEntry[],
  errors: string[]
): void {
  if (visited.has(filePath)) return
  visited.add(filePath)

  let source: string
  try { source = readFileSync(filePath, 'utf8') } catch {
    errors.push(`Cannot read: ${filePath}`)
    return
  }

  const ast = parse(source, { filePath })
  if (!ast.isMarkdownAI) return

  for (const node of ast.nodes) {
    if (node.type === 'include' || node.type === 'import') {
      const n = node as IncludeNode | ImportNode
      const resolved = resolve(docDir, n.path)
      results.push({ path: n.path, type: n.type, line: n.line, resolved })
      if (existsSync(resolved)) {
        collectImports(resolved, dirname(resolved), visited, results, errors)
      }
    }
  }
}

export function runListImports(filePath: string, options: { cwd?: string } = {}): ListImportsResult {
  const resolved = resolve(options.cwd ?? process.cwd(), filePath)
  const imports: ImportEntry[] = []
  const errors: string[] = []
  collectImports(resolved, dirname(resolved), new Set<string>(), imports, errors)
  return { imports, errors, exitCode: errors.length > 0 ? 1 : 0 }
}
