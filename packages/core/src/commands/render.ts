import { readFileSync } from 'node:fs'
import { resolve, dirname, isAbsolute } from 'node:path'
import { parse } from '@markdownai/parser'
import { execute, loadSecurityConfig, checkFilePath, checkAbsolutePath } from '@markdownai/engine'
import type { SecurityConfig } from '@markdownai/engine'
import { aiFilter } from '@markdownai/renderer'
import { loadEnvFile } from '../env-loader.js'

export interface RenderOptions {
  env?: string
  cwd?: string
  verbose?: boolean
  strict?: boolean
  silent?: boolean
  consumer?: string
  format?: 'standard' | 'ai'
  budget?: number
  securityConfig?: SecurityConfig
  passthrough?: boolean
  // v2.0: skill context for local skill-file testing. Mirrors MCP read_file
  // skill_* parameters so docs can be exercised without a running MCP server.
  skillArgs?: string             // raw $ARGUMENTS string
  skillDir?: string              // ${CLAUDE_SKILL_DIR}
  skillSessionId?: string        // ${CLAUDE_SESSION_ID}
  skillEffort?: string           // ${CLAUDE_EFFORT}
}

function buildSkillContext(options: RenderOptions): {
  args: string; argsList: string[]; namedArgs: Record<string, string>; sessionId: string; effort: string; skillDir: string
} | null {
  const hasAny = options.skillArgs !== undefined
    || options.skillDir !== undefined
    || options.skillSessionId !== undefined
    || options.skillEffort !== undefined
  if (!hasAny) return null
  const rawArgs = options.skillArgs ?? ''
  const argsList = rawArgs.trim().length > 0
    ? [...rawArgs.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3] ?? '')
    : []
  return {
    args: rawArgs,
    argsList,
    namedArgs: {},
    sessionId: options.skillSessionId ?? '',
    effort: options.skillEffort ?? '',
    skillDir: options.skillDir ?? '',
  }
}

export interface RenderResult {
  output: string
  errors: string[]
  warnings: string[]
  exitCode: number
}

const SECTION_RE = /<!-- mda-section priority="(critical|high|medium|low)"(?:\s+id="([^"]*)")?\s*-->([\s\S]*?)<!-- \/mda-section -->/g
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface Section { full: string; priority: string; content: string }

function applyBudget(output: string, budget: number): string {
  if (budget <= 0) return output

  const sections: Section[] = []
  for (const m of output.matchAll(SECTION_RE)) {
    sections.push({ full: m[0]!, priority: m[1]!, content: m[3]! })
  }

  if (sections.length === 0) return output

  // Base cost: everything outside sections
  let base = output
  for (const s of sections) base = base.replace(s.full, '')
  let remaining = budget - estimateTokens(base)

  // Sort by priority (critical first, low last) — but drop low first
  const byPriority = [...sections].sort((a, b) => (SEVERITY_ORDER[a.priority] ?? 4) - (SEVERITY_ORDER[b.priority] ?? 4))

  // Determine which sections to keep (greedy from critical down)
  const keep = new Set<Section>()
  for (const s of byPriority) {
    if (s.priority === 'critical') { keep.add(s); continue }
    const cost = estimateTokens(s.content)
    if (remaining >= cost) { keep.add(s); remaining -= cost }
  }
  // Always keep critical regardless
  for (const s of sections) if (s.priority === 'critical') keep.add(s)

  // Rebuild: replace dropped sections with placeholder, keep others with content only
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

function buildSecurityConfig(options: RenderOptions, resolved: string): SecurityConfig {
  if (options.securityConfig) return options.securityConfig
  const json = loadSecurityConfig()
  // CLI default: data ops jail to the document's directory (matches v1.x and the
  // ergonomic expectation of `mai render foo.md` finding files near foo.md).
  // Skill mode (--skill-args set, or invoked via MCP read_file) opts into the
  // v2.0 cwd-as-data-root behavior by virtue of MCP setting data_root="cwd"
  // explicitly. CLI users who want cwd behavior can set filesystem.data_root="cwd"
  // in security.json or pass --cwd <path>.
  const fsConfig = json.filesystem
  const isSkillMode = options.skillArgs !== undefined
  const filesystemConfig = {
    ...fsConfig,
    // If user has not configured data_root, pick the right default per mode.
    source_root: fsConfig.source_root ?? 'auto',
    data_root: fsConfig.data_root ?? (isSkillMode ? 'cwd' : 'auto'),
  }
  return {
    allowShell: json.shell.enabled,
    allowHttp: json.http.enabled,
    allowDb: Object.keys(json.db).length > 0,
    jailRoot: dirname(resolved),
    filesystemConfig,
    shellConfig: json.shell,
  }
}

function postProcessOutput(output: string, options: RenderOptions): string {
  let result = output
  if (options.budget && options.budget > 0) {
    result = applyBudget(result, options.budget)
  } else {
    result = result.replace(/<!-- mda-section priority="[^"]*"(?:\s+id="[^"]*")?\s*-->\n?/g, '')
    result = result.replace(/<!-- \/mda-section -->\n?/g, '')
  }
  if (options.format === 'ai') result = aiFilter(result)
  return result
}

export function runRender(filePath: string, options: RenderOptions = {}): RenderResult {
  const cwd = options.cwd ?? process.cwd()
  const check = isAbsolute(filePath) ? checkAbsolutePath(filePath) : checkFilePath(filePath, cwd)
  if (check.level === 'blocked') return { output: '', errors: [`Path blocked: ${check.reason}`], warnings: [], exitCode: 1 }
  const resolved = resolve(cwd, filePath)
  let source: string
  try {
    source = readFileSync(resolved, 'utf8')
  } catch {
    return { output: '', errors: [`Cannot read file: ${filePath}`], warnings: [], exitCode: 1 }
  }

  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, { filePath: resolved })
  } catch (err) {
    return { output: '', errors: [String(err)], warnings: [], exitCode: 1 }
  }

  const envFiles = options.env ? loadEnvFile(options.env) : {}
  const security = buildSecurityConfig(options, resolved)
  const skillContext = buildSkillContext(options)
  const execOpts: Parameters<typeof execute>[1] = {
    filePath: resolved,
    ctx: {
      envFiles,
      cwd: options.cwd ? resolve(options.cwd) : process.cwd(),
      consumer: options.consumer,
      security,
      ...(skillContext ? { skillContext } : {}),
    },
  }
  if (options.passthrough) execOpts.passthrough = true
  const result = execute(ast, execOpts)

  const output = postProcessOutput(result.output, options)
  const allErrors = options.strict ? [...result.errors, ...result.warnings] : result.errors
  const warnings = options.strict ? [] : result.warnings
  const exitCode = allErrors.length > 0 ? 1 : 0
  return { output, errors: allErrors, warnings, exitCode }
}
