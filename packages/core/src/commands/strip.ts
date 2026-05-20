import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import { strip, checkFilePath, checkAbsolutePath } from '@markdownai/engine'
import { loadEnvFile } from '../env-loader.js'

export interface StripCmdOptions {
  env?: string
  cwd?: string
  output?: string
  verbose?: boolean
  strict?: boolean
  silent?: boolean
}

export interface StripCmdResult {
  output: string
  errors: string[]
  warnings: string[]
  exitCode: number
}

export function runStrip(filePath: string, options: StripCmdOptions = {}): StripCmdResult {
  const cwd = options.cwd ?? process.cwd()
  const check = isAbsolute(filePath) ? checkAbsolutePath(filePath) : checkFilePath(filePath, cwd)
  if (check.level === 'blocked') return { output: '', errors: [`Path blocked: ${check.reason}`], warnings: [], exitCode: 1 }
  if (options.output) {
    const outCheck = isAbsolute(options.output) ? checkAbsolutePath(options.output) : checkFilePath(options.output, cwd)
    if (outCheck.level === 'blocked') return { output: '', errors: [`Output path blocked: ${outCheck.reason}`], warnings: [], exitCode: 1 }
  }
  const resolved = resolve(cwd, filePath)
  let source: string
  try {
    source = readFileSync(resolved, 'utf8')
  } catch {
    return { output: '', errors: [`Cannot read file: ${filePath}`], warnings: [], exitCode: 1 }
  }

  const ast = parse(source, { filePath: resolved })
  const env = options.env ? loadEnvFile(options.env) : {}
  const result = strip(ast, { env })

  const errors: string[] = []
  if (options.strict && result.warnings.length > 0) errors.push(...result.warnings)
  const exitCode = errors.length > 0 ? 1 : 0

  if (options.output) {
    writeFileSync(resolve(cwd, options.output), result.output)
  }

  return {
    output: result.output,
    errors,
    warnings: options.strict ? [] : result.warnings,
    exitCode,
  }
}
