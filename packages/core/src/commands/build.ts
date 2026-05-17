import { writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { runRender } from './render.js'
import type { RenderOptions } from './render.js'

export interface BuildOptions extends RenderOptions {
  output?: string
}

export interface BuildResult {
  output: string
  errors: string[]
  warnings: string[]
  exitCode: number
  outputPath?: string
}

export function runBuild(filePath: string, options: BuildOptions = {}): BuildResult {
  const result = runRender(filePath, options)
  let outputPath: string | undefined

  if (options.output && result.exitCode === 0) {
    const baseCwd = resolve(options.cwd ?? process.cwd())
    outputPath = resolve(baseCwd, options.output)
    if (relative(baseCwd, outputPath).startsWith('..')) {
      return { ...result, exitCode: 1, errors: [...result.errors, `@build: output path confined — access denied: ${options.output}`] }
    }
    try {
      writeFileSync(outputPath, result.output)
    } catch (err) {
      return { ...result, exitCode: 1, errors: [...result.errors, `@build: write failed — ${String(err)}`] }
    }
  }

  return { ...result, ...(outputPath !== undefined ? { outputPath } : {}) }
}
