import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import type { DefineNode } from '@markdownai/parser'

export interface MacroEntry {
  name: string
  params: string[]
  line: number
  local: boolean
}

export interface ListMacrosResult {
  macros: MacroEntry[]
  errors: string[]
  exitCode: number
}

export function runListMacros(filePath: string, options: { cwd?: string } = {}): ListMacrosResult {
  const cwd = options.cwd ?? process.cwd()
  const resolved = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(resolved, 'utf8') } catch {
    return { macros: [], errors: [`Cannot read file: ${filePath}`], exitCode: 1 }
  }

  const ast = parse(source, { filePath: resolved })
  if (!ast.isMarkdownAI) return { macros: [], errors: ['Not a MarkdownAI document'], exitCode: 1 }

  const macros: MacroEntry[] = []
  for (const node of ast.nodes) {
    if (node.type !== 'define') continue
    const def = node as DefineNode
    macros.push({ name: def.name, params: def.params, line: def.line, local: def.local })
  }
  return { macros, errors: [], exitCode: 0 }
}
