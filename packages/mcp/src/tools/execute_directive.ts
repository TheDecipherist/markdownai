import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'

export interface ExecuteDirectiveResult {
  output: string
  warnings: string[]
  errors: string[]
}

export function executeDirective(
  directive: string,
  cwd: string,
  env?: Record<string, string>
): ExecuteDirectiveResult {
  const doc = `@markdownai\n${directive}`
  const ast = parse(doc)
  if (!ast.isMarkdownAI) {
    return { output: '', warnings: [], errors: ['Failed to parse directive'] }
  }
  const result = execute(ast, { ctx: { envFiles: env ?? {}, cwd } })
  return { output: result.output, warnings: result.warnings, errors: result.errors }
}
