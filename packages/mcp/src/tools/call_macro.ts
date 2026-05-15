import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

export interface CallMacroResult {
  output: string
  warnings: string[]
  found: boolean
}

export function callMacro(
  filePath: string,
  macroName: string,
  args: Record<string, string>,
  cwd: string,
  env?: Record<string, string>
): CallMacroResult {
  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch {
    return { output: '', warnings: [`Cannot read file: ${filePath}`], found: false }
  }

  // Build a document that imports the file and calls the macro
  const callDoc = `@markdownai\n@import ./${filePath}\n@call ${macroName}(${Object.entries(args).map(([k, v]) => `${k}=${v}`).join(', ')})`
  const ast = parse(callDoc)
  if (!ast.isMarkdownAI) return { output: '', warnings: [], found: false }

  const result = execute(ast, { ctx: { envFiles: env ?? {}, cwd } })

  // Check if macro was found by looking for empty output (macro not found returns '')
  const macroInSource = source.includes(`@define ${macroName}`)
  return { output: result.output, warnings: result.warnings, found: macroInSource }
}
