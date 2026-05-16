import { readFileSync } from 'node:fs'
import { resolve, relative, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute } from '@markdownai/engine'
import { aiFilter } from '@markdownai/renderer'

export interface ReadFileArgs {
  path: string
  phase?: string
  env?: Record<string, string>
  format?: 'ai' | 'standard'
  budget?: number
  consumer?: string
}

export interface ReadFileResult {
  content: string
  isMarkdownAI: boolean
  warnings: string[]
}

function isConfined(filePath: string, cwd: string): boolean {
  if (isAbsolute(filePath)) return false
  const rel = relative(cwd, resolve(cwd, filePath))
  return !rel.startsWith('..')
}

export function readFile(args: ReadFileArgs, cwd: string): ReadFileResult {
  if (!isConfined(args.path, cwd)) {
    return { content: '', isMarkdownAI: false, warnings: [`Path traversal blocked: "${args.path}"`] }
  }
  const fullPath = resolve(cwd, args.path)
  let source: string
  try { source = readFileSync(fullPath, 'utf8') } catch {
    return { content: '', isMarkdownAI: false, warnings: [`Cannot read file: ${args.path}`] }
  }

  const ast = parse(source, { filePath: fullPath })
  if (!ast.isMarkdownAI) {
    return { content: source, isMarkdownAI: false, warnings: [] }
  }

  const consumer = args.consumer ?? 'ai'
  const result = execute(ast, {
    filePath: fullPath,
    ctx: { envFiles: args.env ?? {}, phase: args.phase ?? null, consumer },
  })

  let content = result.output

  // Apply budget pass (keeps section markers for the pass, then strips them)
  const budget = args.budget ?? 0
  if (budget > 0) {
    content = applyBudget(content, budget)
  } else {
    content = content
      .replace(/<!-- mda-section priority="[^"]*"(?:\s+id="[^"]*")?\s*-->\n?/g, '')
      .replace(/<!-- \/mda-section -->\n?/g, '')
  }

  // MCP default: ai format — callers must explicitly pass format="standard" to opt out
  const format = args.format ?? 'ai'
  if (format === 'ai') content = aiFilter(content)

  return { content, isMarkdownAI: true, warnings: result.warnings }
}

const SECTION_RE = /<!-- mda-section priority="(critical|high|medium|low)"(?:\s+id="[^"]*")?\s*-->([\s\S]*?)<!-- \/mda-section -->/g
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function applyBudget(output: string, budget: number): string {
  interface Section { full: string; priority: string; content: string }
  const sections: Section[] = []
  for (const m of output.matchAll(SECTION_RE)) {
    sections.push({ full: m[0]!, priority: m[1]!, content: m[2]! })
  }
  if (sections.length === 0) return output.replace(/<!-- mda-section priority="[^"]*"(?:\s+id="[^"]*")?\s*-->\n?/g, '').replace(/<!-- \/mda-section -->\n?/g, '')

  let base = output
  for (const s of sections) base = base.replace(s.full, '')
  let remaining = budget - estimateTokens(base)

  const byPriority = [...sections].sort((a, b) => (SEVERITY_ORDER[a.priority] ?? 4) - (SEVERITY_ORDER[b.priority] ?? 4))
  const keep = new Set<Section>()
  for (const s of byPriority) {
    if (s.priority === 'critical') { keep.add(s); continue }
    const cost = estimateTokens(s.content)
    if (remaining >= cost) { keep.add(s); remaining -= cost }
  }
  for (const s of sections) if (s.priority === 'critical') keep.add(s)

  let result = output
  for (const s of sections) {
    if (keep.has(s)) {
      result = result.replace(s.full, s.content.trim())
    } else {
      result = result.replace(s.full, `<!-- [Section omitted — budget ${budget} tokens] -->`)
    }
  }
  return result
}
