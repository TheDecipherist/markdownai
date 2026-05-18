import { existsSync, statSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'
import { validateMcpInput, validateEnvRecord } from '../validate.js'

export interface ExecuteDirectiveResult {
  output: string
  warnings: string[]
  errors: string[]
}

// Only these directive types may be executed via MCP — no shell, no filesystem traversal
const ALLOWED_DIRECTIVES = new Set([
  'env', 'define', 'call', 'list', 'read', 'date', 'count', 'tree',
])

function parsedDirectiveType(directive: string): string | null {
  const match = directive.trimStart().match(/^@(\w+)/)
  return match?.[1] ?? null
}

function validateCwd(cwd: string): string | null {
  if (!cwd || typeof cwd !== 'string') return 'cwd must be a non-empty string'
  if (!isAbsolute(cwd)) return 'cwd must be an absolute path'
  try {
    if (!existsSync(cwd) || !statSync(cwd).isDirectory()) return `cwd does not exist or is not a directory: ${cwd}`
  } catch { return `cwd is not accessible: ${cwd}` }
  return null
}

export function executeDirective(
  directive: string,
  cwd: string,
  env?: Record<string, string>
): ExecuteDirectiveResult {
  // Validate all MCP inputs before any processing
  const inputValidation = validateMcpInput([
    { field: 'directive', value: directive, noPathInjection: false },
    { field: 'cwd', value: cwd, noPathInjection: true },
  ])
  const envErrors = validateEnvRecord(env)
  const allErrors = [...inputValidation.errors, ...envErrors]
  if (allErrors.length > 0) {
    return { output: '', warnings: [], errors: allErrors.map(e => `${e.field}: ${e.reason}`) }
  }

  const cwdError = validateCwd(cwd)
  if (cwdError) return { output: '', warnings: [], errors: [cwdError] }

  const resolvedCwd = resolve(cwd)
  // Strip embedded newlines to prevent multi-directive injection via a single directive= string
  const sanitized = directive.replace(/[\n\r]/g, ' ')
  const directiveType = parsedDirectiveType(sanitized)
  if (!directiveType || !ALLOWED_DIRECTIVES.has(directiveType)) {
    return {
      output: '',
      warnings: [],
      errors: [`Directive type not permitted via MCP: "${directiveType ?? 'unknown'}". Allowed: ${[...ALLOWED_DIRECTIVES].join(', ')}`],
    }
  }

  const doc = `@markdownai\n${sanitized}`
  const ast = parse(doc)
  if (!ast.isMarkdownAI) {
    return { output: '', warnings: [], errors: ['Failed to parse directive'] }
  }
  const result = execute(ast, { ctx: { envFiles: env ?? {}, cwd: resolvedCwd } })
  return { output: result.output, warnings: result.warnings, errors: result.errors }
}
