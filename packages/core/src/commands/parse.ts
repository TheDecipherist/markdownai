import { readFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { parse, ParseError } from '@markdownai/parser'
import { checkFilePath } from '@markdownai/engine'

export interface ParseCmdOptions {
  cwd?: string
  pretty?: boolean
  node?: string
}

export interface ParseCmdResult {
  output: string
  errors: string[]
  exitCode: number
}

export function runParse(filePath: string, options: ParseCmdOptions = {}): ParseCmdResult {
  const cwd = options.cwd ?? process.cwd()
  if (!isAbsolute(filePath)) {
    const check = checkFilePath(filePath, cwd)
    if (check.level === 'blocked') return { output: '', errors: [`Path blocked: ${check.reason}`], exitCode: 1 }
  }
  const resolved = resolve(cwd, filePath)
  let source: string
  try {
    source = readFileSync(resolved, 'utf8')
  } catch {
    return { output: '', errors: [`Cannot read file: ${filePath}`], exitCode: 1 }
  }

  try {
    const ast = parse(source, { filePath: resolved })
    const filtered = options.node
      ? { ...ast, nodes: ast.nodes.filter(n => n.type === options.node) }
      : ast
    const json = options.pretty
      ? JSON.stringify(filtered, null, 2)
      : JSON.stringify(filtered)
    return { output: json, errors: [], exitCode: 0 }
  } catch (err) {
    const msg = err instanceof ParseError ? err.message : String(err)
    return { output: '', errors: [msg], exitCode: 1 }
  }
}
