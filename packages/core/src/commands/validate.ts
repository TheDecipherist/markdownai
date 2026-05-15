import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parse, ParseError } from '@markdownai/parser'
import type { ASTNode, ConditionalBranch } from '@markdownai/parser'

export interface ValidateOptions {
  env?: string
  cwd?: string
  strict?: boolean
}

export interface ValidateResult {
  errors: string[]
  warnings: string[]
  exitCode: number
}

export function runValidate(filePath: string, options: ValidateOptions = {}): ValidateResult {
  const resolved = resolve(options.cwd ?? process.cwd(), filePath)
  let source: string
  try {
    source = readFileSync(resolved, 'utf8')
  } catch {
    return { errors: [`Cannot read file: ${filePath}`], warnings: [], exitCode: 1 }
  }

  const errors: string[] = []
  const warnings: string[] = []

  try {
    const ast = parse(source, { filePath: resolved })
    if (!ast.isMarkdownAI) {
      errors.push('Not a MarkdownAI document (missing @markdownai header on line 1)')
    } else {
      const defines = collectDefines(ast.nodes)
      checkNodes(ast.nodes, defines, errors, warnings, resolved)
    }
  } catch (err) {
    errors.push(err instanceof ParseError ? err.message : String(err))
  }

  const effectiveErrors = options.strict ? [...errors, ...warnings] : errors
  return { errors: effectiveErrors, warnings: options.strict ? [] : warnings, exitCode: effectiveErrors.length > 0 ? 1 : 0 }
}

function collectDefines(nodes: ASTNode[]): Set<string> {
  const defines = new Set<string>()
  for (const node of nodes) {
    if (node.type === 'define') {
      defines.add(node.name)
      collectDefines(node.body).forEach(n => defines.add(n))
    } else if (node.type === 'phase') {
      collectDefines(node.body).forEach(n => defines.add(n))
    } else if (node.type === 'conditional') {
      node.branches.forEach((b: ConditionalBranch) => collectDefines(b.body).forEach(n => defines.add(n)))
    }
  }
  return defines
}

function checkNodes(nodes: ASTNode[], defines: Set<string>, errors: string[], warnings: string[], filePath: string): void {
  const dir = dirname(filePath)
  for (const node of nodes) {
    checkNode(node, defines, errors, warnings, filePath, dir)
  }
}

function checkNode(node: ASTNode, defines: Set<string>, errors: string[], warnings: string[], filePath: string, dir: string): void {
  if (node.type === 'include' || node.type === 'import') {
    if (!existsSync(resolve(dir, node.path))) {
      errors.push(`@${node.type}: file not found: ${node.path} (referenced in ${filePath}:${node.line})`)
    }
  }
  if (node.type === 'call' && !defines.has(node.name)) {
    errors.push(`@call: macro "${node.name}" is not defined (${filePath}:${node.line})`)
  }
  if (node.type === 'env' && node.fallback === null) {
    warnings.push(`@env: ${node.name} has no fallback value (${filePath}:${node.line})`)
  }
  if (node.type === 'define' || node.type === 'phase') {
    checkNodes(node.body, defines, errors, warnings, filePath)
  }
  if (node.type === 'conditional') {
    node.branches.forEach((b: ConditionalBranch) => checkNodes(b.body, defines, errors, warnings, filePath))
  }
}
