import { makeContext, evalExpression } from '@markdownai/engine'
import { loadEnvFile } from '../env-loader.js'

export interface EvalOptions {
  env?: string
}

export interface EvalResult {
  output: string
  exitCode: number
  errors: string[]
}

export function runEval(expression: string, options: EvalOptions = {}): EvalResult {
  const envFiles = options.env ? loadEnvFile(options.env) : {}
  const ctx = makeContext({ envFiles })
  try {
    const output = evalExpression(expression, ctx)
    return { output, exitCode: 0, errors: ctx.warnings }
  } catch (err) {
    return { output: '', exitCode: 1, errors: [String(err)] }
  }
}
