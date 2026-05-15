import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runRender } from './render.js'
import type { RenderOptions } from './render.js'

export interface BuildOptions extends RenderOptions {
  output?: string
  watch?: boolean
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
    outputPath = resolve(options.cwd ?? process.cwd(), options.output)
    writeFileSync(outputPath, result.output)
  }

  return { ...result, outputPath }
}
