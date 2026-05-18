import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { parse } from '@markdownai/parser'
import type { IncludeNode, ImportNode } from '@markdownai/parser'
import { checkFilePath } from '@markdownai/engine'

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

function isWithinDocRoot(resolvedPath: string, docRoot: string): boolean {
  const rel = relative(docRoot, resolvedPath)
  return !rel.startsWith('..')
}

function collectImports(
  filePath: string,
  docRoot: string,
  visited: Set<string>,
  results: ImportEntry[],
  errors: string[]
): void {
  if (visited.has(filePath)) return
  if (!isWithinDocRoot(filePath, docRoot)) {
    errors.push(`Path traversal blocked: ${filePath} is outside document root ${docRoot}`)
    return
  }
  visited.add(filePath)

  let source: string
  try { source = readFileSync(filePath, 'utf8') } catch {
    errors.push(`Cannot read: ${filePath}`)
    return
  }

  const ast = parse(source, { filePath })
  if (!ast.isMarkdownAI) return

  const fileDir = dirname(filePath)
  for (const node of ast.nodes) {
    if (node.type === 'include' || node.type === 'import') {
      const n = node as IncludeNode | ImportNode
      // checkFilePath validates relative directive paths against security rules
      const check = checkFilePath(n.path, fileDir)
      if (check.level === 'blocked') {
        errors.push(`Path traversal blocked in ${filePath}: "${n.path}" — ${check.reason}`)
        continue
      }
      const resolved = resolve(fileDir, n.path)
      if (!isWithinDocRoot(resolved, docRoot)) {
        errors.push(`Path traversal blocked in ${filePath}: "${n.path}" escapes document root`)
        continue
      }
      results.push({ path: n.path, type: n.type, line: n.line, resolved })
      if (existsSync(resolved)) {
        collectImports(resolved, docRoot, visited, results, errors)
      }
    }
  }
}

export function runListImports(filePath: string, options: { cwd?: string } = {}): ListImportsResult {
  const resolved = resolve(options.cwd ?? process.cwd(), filePath)
  const docRoot = dirname(resolved)
  const imports: ImportEntry[] = []
  const errors: string[] = []
  collectImports(resolved, docRoot, new Set<string>(), imports, errors)
  return { imports, errors, exitCode: errors.length > 0 ? 1 : 0 }
}
