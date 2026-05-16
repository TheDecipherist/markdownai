import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

export interface CallMacroResult {
  output: string
  warnings: string[]
  found: boolean
  error?: string
}

// Macro names must be simple identifiers — no injection via name
const VALID_MACRO_NAME = /^\w+$/

function isConfined(filePath: string, cwd: string): boolean {
  if (isAbsolute(filePath)) return false
  const rel = relative(cwd, resolve(cwd, filePath))
  return !rel.startsWith('..')
}

function escapeArgValue(v: string): string {
  // Remove characters that could inject new directives or break the @call arg list
  return v.replace(/[`@\n\r]/g, '')
}

export function callMacro(
  filePath: string,
  macroName: string,
  args: Record<string, string>,
  cwd: string,
  env?: Record<string, string>
): CallMacroResult {
  if (!isConfined(filePath, cwd)) {
    return { output: '', warnings: [], found: false, error: `Path traversal blocked: "${filePath}"` }
  }
  if (!VALID_MACRO_NAME.test(macroName)) {
    return { output: '', warnings: [], found: false, error: `Invalid macro name: "${macroName}"` }
  }

  // Validate arg keys too — they appear in the @call arg list
  for (const key of Object.keys(args)) {
    if (!VALID_MACRO_NAME.test(key)) {
      return { output: '', warnings: [], found: false, error: `Invalid arg key: "${key}"` }
    }
  }

  const full = resolve(cwd, filePath)
  let source: string
  try { source = readFileSync(full, 'utf8') } catch {
    return { output: '', warnings: [`Cannot read file: ${filePath}`], found: false }
  }

  // Verify macro exists: parse the import file and check its define nodes (not substring search)
  const importAst = parse(source, { filePath: full, inImport: true })
  const macroExists = importAst.nodes.some(n => n.type === 'define' && (n as { name: string }).name === macroName)
  if (!macroExists) {
    return { output: '', warnings: [], found: false }
  }

  const sanitizedArgs = Object.entries(args)
    .map(([k, v]) => `${k}=${escapeArgValue(v)}`)
    .join(', ')

  // filePath here is relative — safe to embed after confinement check above
  const callDoc = `@markdownai\n@import ./${filePath}\n@call ${macroName}(${sanitizedArgs})`
  const ast = parse(callDoc)
  if (!ast.isMarkdownAI) return { output: '', warnings: [], found: false }

  const result = execute(ast, { ctx: { envFiles: env ?? {}, cwd, docDir: resolve(cwd) } })
  return { output: result.output, warnings: result.warnings, found: true }
}
