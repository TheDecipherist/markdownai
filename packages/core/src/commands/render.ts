import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'
import { loadEnvFile } from '../env-loader.js'

export interface RenderOptions {
  env?: string
  cwd?: string
  verbose?: boolean
  strict?: boolean
  silent?: boolean
}

export interface RenderResult {
  output: string
  errors: string[]
  warnings: string[]
  exitCode: number
}

export function runRender(filePath: string, options: RenderOptions = {}): RenderResult {
  const resolved = resolve(options.cwd ?? process.cwd(), filePath)
  let source: string
  try {
    source = readFileSync(resolved, 'utf8')
  } catch {
    return { output: '', errors: [`Cannot read file: ${filePath}`], warnings: [], exitCode: 1 }
  }

  let ast
  try {
    ast = parse(source, { filePath: resolved })
  } catch (err) {
    return { output: '', errors: [String(err)], warnings: [], exitCode: 1 }
  }

  const envFiles = options.env ? loadEnvFile(options.env) : {}
  const result = execute(ast, {
    filePath: resolved,
    ctx: { envFiles, cwd: options.cwd ? resolve(options.cwd) : process.cwd() },
  })

  const allErrors = options.strict ? [...result.errors, ...result.warnings] : result.errors
  const warnings = options.strict ? [] : result.warnings
  const exitCode = allErrors.length > 0 ? 1 : 0
  return { output: result.output, errors: allErrors, warnings, exitCode }
}
