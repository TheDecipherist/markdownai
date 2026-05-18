import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute, checkFilePath } from '@markdownai/engine'
import { aiFilter } from '@markdownai/renderer'

export interface ReadFileArgs {
  path: string
  phase?: string
  env?: Record<string, string>
  format?: 'ai' | 'standard'
  budget?: number
  consumer?: string
  // Claude Code skill context — populated when rendering a skill/command file
  skillArgs?: string                        // $ARGUMENTS raw string
  skillNamedArgs?: Record<string, string>   // named args from frontmatter arguments:
  skillSessionId?: string                   // ${CLAUDE_SESSION_ID}
  skillEffort?: string                      // ${CLAUDE_EFFORT}
  skillDir?: string                         // ${CLAUDE_SKILL_DIR}
}

export interface ReadFileResult {
  content: string
  isMarkdownAI: boolean
  warnings: string[]
}

function buildSkillContext(args: ReadFileArgs): {
  args: string; argsList: string[]; namedArgs: Record<string, string>; sessionId: string; effort: string; skillDir: string
} {
  const rawSkillArgs = args.skillArgs ?? ''
  const skillArgsList = rawSkillArgs.trim().length > 0
    ? [...rawSkillArgs.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '')
    : []
  return {
    args: rawSkillArgs,
    argsList: skillArgsList,
    namedArgs: args.skillNamedArgs ?? {},
    sessionId: args.skillSessionId ?? '',
    effort: args.skillEffort ?? '',
    skillDir: args.skillDir ?? '',
  }
}

function postProcessContent(content: string, args: ReadFileArgs): string {
  const budget = args.budget ?? 0
  let result = budget > 0
    ? applyBudget(content, budget)
    : content
        .replace(/<!-- mda-section priority="[^"]*"(?:\s+id="[^"]*")?\s*-->\n?/g, '')
        .replace(/<!-- \/mda-section -->\n?/g, '')
  // MCP default: ai format — callers must explicitly pass format="standard" to opt out
  const format = args.format ?? 'ai'
  if (format === 'ai') result = aiFilter(result)
  return result
}

export function readFile(args: ReadFileArgs, cwd: string): ReadFileResult {
  const check = checkFilePath(args.path, cwd)
  if (check.level === 'blocked') {
    return { content: '', isMarkdownAI: false, warnings: [`Path traversal blocked: "${args.path}" — ${check.reason}`] }
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

  const result = execute(ast, {
    filePath: fullPath,
    ctx: {
      envFiles: args.env ?? {},
      phase: args.phase ?? null,
      consumer: args.consumer ?? 'ai',
      skillContext: buildSkillContext(args),
    },
  })

  const content = postProcessContent(result.output, args)
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
