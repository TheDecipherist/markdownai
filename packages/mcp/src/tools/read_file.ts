import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

export interface ReadFileArgs {
  path: string
  phase?: string
  env?: Record<string, string>
}

export interface ReadFileResult {
  content: string
  isMarkdownAI: boolean
  warnings: string[]
}

export function readFile(args: ReadFileArgs, cwd: string): ReadFileResult {
  const fullPath = resolve(cwd, args.path)
  let source: string
  try { source = readFileSync(fullPath, 'utf8') } catch {
    return { content: '', isMarkdownAI: false, warnings: [`Cannot read file: ${args.path}`] }
  }

  const ast = parse(source, { filePath: fullPath })
  if (!ast.isMarkdownAI) {
    return { content: source, isMarkdownAI: false, warnings: [] }
  }

  const result = execute(ast, {
    filePath: fullPath,
    ctx: { envFiles: args.env ?? {}, phase: args.phase ?? null },
  })
  return { content: result.output, isMarkdownAI: true, warnings: result.warnings }
}
