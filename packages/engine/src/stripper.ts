import { runInNewContext } from 'node:vm'
import type { ASTNode, ParseResult, InterpolationSpan } from '@markdownai/parser'

export interface StripOptions {
  env?: Record<string, string>
}

export interface StripResult {
  output: string
  warnings: string[]
}

function evalConditionForStrip(condition: string, env: Record<string, string>, warnings: string[]): boolean {
  try { return Boolean(runInNewContext(condition, { ...env }, { timeout: 200 })) } catch (err) {
    warnings.push(`strip: condition eval failed — "${condition}": ${String(err)}`)
    return false
  }
}

function resolveInterpolation(expr: string, env: Record<string, string>, warnings: string[]): string {
  const trimmed = expr.trim()
  if (/^[A-Z_][A-Z0-9_]*$/.test(trimmed)) return env[trimmed] ?? ''
  try { return String(runInNewContext(trimmed, { ...env }, { timeout: 200 }) ?? '') } catch (err) {
    warnings.push(`strip: interpolation failed — "${trimmed}": ${String(err)}`)
    return ''
  }
}

function stripInterpolations(text: string, spans: InterpolationSpan[], env: Record<string, string>, warnings: string[]): string {
  if (spans.length === 0) return text
  let result = ''
  let pos = 0
  for (const span of spans) {
    result += text.slice(pos, span.start)
    result += span.escaped ? `{{${span.expression}}}` : resolveInterpolation(span.expression, env, warnings)
    pos = span.end
  }
  return result + text.slice(pos)
}

function stripNode(node: ASTNode, env: Record<string, string>, warnings: string[]): string {
  switch (node.type) {
    case 'header': return ''
    case 'include': return ''
    case 'import': return ''
    case 'env': return ''
    case 'connect': return ''
    case 'transition': return ''
    case 'render': return ''
    case 'call': return ''
    case 'define': return ''
    case 'list': return ''
    case 'read': return ''
    case 'query': return ''
    case 'db': return ''
    case 'http': return ''
    case 'tree': return ''
    case 'date': return ''
    case 'count': return ''
    case 'pipe': return ''
    case 'note': return ''
    case 'graph': return node.raw
    case 'passthrough': return node.raw
    case 'markdown': return stripInterpolations(node.text, node.interpolations, env, warnings)
    case 'phase': {
      const parts = node.body.map(n => stripNode(n, env, warnings)).filter(s => s !== '')
      return parts.join('\n')
    }
    case 'conditional': {
      for (const branch of node.branches) {
        if (branch.condition === null) {
          const parts = branch.body.map(n => stripNode(n, env, warnings)).filter(s => s !== '')
          return parts.join('\n')
        }
        // Warn about unset variables in condition
        const unset = [...branch.condition.matchAll(/\b([A-Z_][A-Z0-9_]*)\b/g)]
          .map(m => m[1]!)
          .filter(v => !(v in env))
        for (const v of unset) {
          if (!warnings.includes(`Unset variable in @if: ${v}`)) {
            warnings.push(`Unset variable in @if: ${v}`)
          }
        }
        if (evalConditionForStrip(branch.condition, env, warnings)) {
          const parts = branch.body.map(n => stripNode(n, env, warnings)).filter(s => s !== '')
          return parts.join('\n')
        }
      }
      return ''
    }
    default: return ''
  }
}

export function strip(ast: ParseResult, options?: StripOptions): StripResult {
  if (!ast.isMarkdownAI) {
    return { output: '', warnings: ['Not a MarkdownAI document'] }
  }
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v
  }
  if (options?.env) Object.assign(env, options.env)

  const warnings: string[] = []
  const parts: string[] = []
  for (const node of ast.nodes) {
    const out = stripNode(node, env, warnings)
    if (out !== '') parts.push(out)
  }
  return { output: parts.join('\n'), warnings }
}
