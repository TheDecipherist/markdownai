import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import { strip } from '@markdownai/engine'
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
  const resolved = resolve(options.cwd ?? process.cwd(), filePath)
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
    writeFileSync(resolve(options.cwd ?? process.cwd(), options.output), result.output)
  }

  return {
    output: result.output,
    errors,
    warnings: options.strict ? [] : result.warnings,
    exitCode,
  }
}
