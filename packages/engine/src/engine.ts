import { resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import type {
  ASTNode, ParseResult, ConnectNode, DefineNode, CallNode, PhaseNode, ConditionalNode, SwitchNode, PipeNode,
  InterpolationSpan, ShellInlineSpan, RenderNode, PromptNode, SectionNode, ConceptNode, ConstraintNode,
  ChunkBoundaryNode, NoteNode, EventNode,
} from '@markdownai/parser'
import { parse as parserParse } from '@markdownai/parser'
import { render } from '@markdownai/renderer'
import type { RenderType, RendererInput } from '@markdownai/renderer'
import { makeContext, resolveEnv, type EngineContext } from './context.js'
import { substituteParams } from './macros.js'
import { evalCondition, evalExpression } from './conditions.js'
import { runBuiltin, isBuiltin } from './pipe.js'
import { runShell } from './shell.js'
import { executeList, executeRead, executeCount, executeDate, executeTree, executeDb, executeHttp, executeQuery } from './sources.js'
import { executeMkdir, executeCopy, executeAppendIfMissing, executeUpdateFrontmatter } from './write-ops.js'
import { executeReadFrontmatter, executeHash } from './read-ops.js'
import { executeTest, executeCheck, executeRenderTemplate, setEngineExecute } from './exec-ops.js'
import { executeForeach, executeSet, setIterEngine } from './iter-ops.js'
import { resolveInterpolations, evalExpr } from './engine-interpolate.js'
import { FatalError, versionIsNewer, loadStdlib, executeImport, executeInclude } from './engine-include.js'
import { executeEvent } from './event.js'
import { parseTraceConfig } from './trace/config.js'
import { emitSpan } from './trace/emit.js'
import { extractArgs } from './trace/span.js'
import { applyMasking } from './security/masking.js'
import { expandPatterns } from './security/path-expand.js'
import { executeMarkdownaiDetect, executePluginData } from './plugin-detect-exec.js'

export type { EngineContext }
export { FatalError }

const MARKDOWNAI_VERSION = '1.0'
const VALID_CONNECTION_TYPES = new Set(['mongodb', 'postgres', 'mysql', 'mssql', 'sqlite', 'redis', 'elasticsearch'])

export interface EngineOptions {
  ctx?: Partial<EngineContext>
  filePath?: string
  passthrough?: boolean
}

export interface EngineResult {
  output: string
  errors: string[]
  warnings: string[]
  events: import('./context.js').EngineEvent[]
}

function resolveGitMeta(cwd: string): { hash: string; short: string } | null {
  try {
    const result = spawnSync('git', ['log', '-1', '--format=%H %h'], { cwd, encoding: 'utf8', timeout: 2000 })
    if (result.status !== 0 || !result.stdout?.trim()) return null
    const parts = result.stdout.trim().split(' ')
    const hash = parts[0] ?? ''
    const short = parts[1] ?? hash.slice(0, 7)
    return hash ? { hash, short } : null
  } catch {
    return null
  }
}

/**
 * Resolve sourceJail and dataJail on the EngineContext.
 *
 * Source ops (@import / @include) jail to source_root. Data ops (@list / @read /
 * @tree / @count / file.*) jail to data_root. Both can be configured in
 * security.json's filesystem section:
 *
 *   source_root: "auto" | "cwd" | <absolute path>   (default: "auto")
 *   data_root:   "auto" | "cwd" | <absolute path>   (default: "cwd")
 *
 *   "auto" → dirname(mainFile) (the document directory)
 *   "cwd"  → process.cwd()
 *
 * Explicit values on ctx.security.sourceJail / dataJail (set by the caller,
 * e.g. MCP read_file) take precedence over filesystem config.
 *
 * Falls back to ctx.security.jailRoot when neither config nor caller set the
 * v2.0 fields — keeps legacy code paths working.
 */
function resolveJailRoots(ctx: EngineContext, mainFile: string | null): void {
  const fsConfig = ctx.security.filesystemConfig
  const docDir = mainFile ? dirname(mainFile) : ctx.docDir
  const cwd = ctx.cwd

  // Resolve a root spec: "auto" → docDir, "cwd" → process cwd, abs path → as-is.
  // The default argument is used when the config field is absent (per-op default).
  const resolveRoot = (raw: string | undefined, defaultMode: 'auto' | 'cwd'): string => {
    const mode = raw ?? defaultMode
    if (mode === 'auto') return docDir
    if (mode === 'cwd') return cwd
    return resolve(mode)
  }

  // sourceJail: explicit override > config (default "auto" = docDir)
  if (ctx.security.sourceJail === undefined || ctx.security.sourceJail === null) {
    ctx.security.sourceJail = resolveRoot(fsConfig?.source_root, 'auto')
  }

  // dataJail: explicit override > config (default "cwd" = process cwd)
  // v2.0: cwd is the canonical default. Callers wanting v1.x behavior set
  // filesystem.data_root to "auto" or assign dataJail explicitly.
  if (ctx.security.dataJail === undefined || ctx.security.dataJail === null) {
    ctx.security.dataJail = resolveRoot(fsConfig?.data_root, 'cwd')
  }

  // Allow-lists: pre-expand ${VAR} placeholders so check-time stays cheap.
  if (ctx.security.allowedSourcePaths === undefined) {
    ctx.security.allowedSourcePaths = expandAllowList(fsConfig?.allowed_source_paths, ctx)
  }
  if (ctx.security.allowedDataPaths === undefined) {
    ctx.security.allowedDataPaths = expandAllowList(fsConfig?.allowed_data_paths, ctx)
  }

  // Write jail: only resolved if writes are enabled in config. The directives
  // themselves (@mkdir / @copy / @append-if-missing) check writeEnabled and
  // refuse if false.
  if (ctx.security.writeEnabled === undefined) {
    ctx.security.writeEnabled = fsConfig?.write_enabled ?? false
  }
  if (ctx.security.writeJail === undefined || ctx.security.writeJail === null) {
    if (ctx.security.writeEnabled) {
      ctx.security.writeJail = resolveRoot(fsConfig?.write_root, 'cwd')
    } else {
      ctx.security.writeJail = null
    }
  }
  if (ctx.security.allowedWritePaths === undefined) {
    ctx.security.allowedWritePaths = expandAllowList(fsConfig?.allowed_write_paths, ctx)
  }
}

function expandAllowList(raw: string[] | undefined, ctx: EngineContext): string[] {
  if (!raw || raw.length === 0) return []
  const env: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const skillDir = ctx.skillContext?.skillDir
  const sessionId = ctx.skillContext?.sessionId
  const expandCtx: import('./security/path-expand.js').PatternExpandContext = { env }
  if (skillDir) expandCtx.skillDir = skillDir
  if (sessionId) expandCtx.sessionId = sessionId
  return expandPatterns(raw, expandCtx)
}

export function execute(ast: ParseResult, options?: EngineOptions): EngineResult {
  if (!ast.isMarkdownAI && !options?.passthrough) {
    return { output: '', errors: ['Not a MarkdownAI document (missing @markdownai header)'], warnings: [], events: [] }
  }
  const base = makeContext(options?.ctx)
  if (!base.runId) base.runId = crypto.randomUUID()
  if (!base.gitMeta) base.gitMeta = resolveGitMeta(base.cwd)
  if (!base.traceConfig) base.traceConfig = parseTraceConfig(process.env['MARKDOWNAI_TRACE'])
  loadStdlib(base)
  const mainFile = options?.filePath ? resolve(options.filePath) : null
  if (mainFile) {
    base.docDir = dirname(mainFile)
    base.resolutionStack.add(mainFile)
    if (base.security.jailRoot === null) {
      base.security = { ...base.security, jailRoot: dirname(mainFile) }
    }
  }
  // v2.0: resolve source and data jails from filesystem config (if not already
  // set by the caller). source defaults to dirname(mainFile); data defaults to
  // process cwd. Both can be overridden via filesystem.{source,data}_root.
  resolveJailRoots(base, mainFile)
  const errors: string[] = []
  const parts: string[] = []

  if (ast.version && versionIsNewer(ast.version, MARKDOWNAI_VERSION)) {
    base.warnings.push(`Document requires @markdownai v${ast.version} but installed version is v${MARKDOWNAI_VERSION}`)
  }

  for (const node of ast.nodes) {
    try {
      const out = walkNode(node, base)
      if (out !== '' || (node.type === 'markdown' && node.text.trim() === '')) parts.push(out)
    } catch (err) {
      errors.push(String(err))
    }
  }
  if (mainFile) {
    base.resolutionStack.delete(mainFile)
    base.completedSet.add(mainFile)
  }
  const joined = parts.join('\n').trimStart()
  const output = base.consumer === 'ai' ? injectAiPrefixes(joined, base) : joined
  return { output, errors, warnings: base.warnings, events: base.events }
}

// Inject execute + parse into exec-ops for @render-template sub-renders.
// This breaks the circular import (exec-ops cannot statically import engine).
setEngineExecute(execute, parserParse)
setIterEngine(walkNodes, resolveInterpolations)

function injectAiPrefixes(body: string, ctx: EngineContext): string {
  const prefixes: string[] = []
  if (ctx.glossary.size > 0) {
    const rows = [...ctx.glossary.entries()].map(([k, v]) => `**${k}** — ${v}`).join('\n')
    prefixes.push(`## Glossary\n\n${rows}\n\n---`)
  }
  if (ctx.constraints.length > 0) {
    const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const sorted = [...ctx.constraints].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
    const rows = sorted.map(c => `| ${c.id} | ${c.severity.toUpperCase()} | ${c.body.replace(/\n/g, ' ')} |`).join('\n')
    prefixes.push(`## Constraints\n\n| ID | Severity | Rule |\n|----|----------|------|\n${rows}\n\n---`)
  }
  return prefixes.length > 0 ? prefixes.join('\n\n') + '\n\n' + body : body
}

function walkNodes(nodes: ASTNode[], ctx: EngineContext): string[] {
  const parts: string[] = []
  for (const node of nodes) {
    try {
      const out = walkNode(node, ctx)
      if (out !== '' || (node.type === 'markdown' && node.text.trim() === '')) parts.push(out)
    } catch (err) {
      if (err instanceof FatalError) throw err
      ctx.warnings.push(String(err))
    }
  }
  return parts
}

function walkNodeCore(node: ASTNode, ctx: EngineContext): string {
  switch (node.type) {
    case 'header': return ''
    case 'transition': return ''
    case 'passthrough': return node.raw
    case 'graph': return node.raw
    case 'markdown': return resolveInterpolations(node.text, node.interpolations, ctx, node.shellInlines)
    case 'env': return resolveEnv(node.name, node.fallback, ctx)
    case 'connect': {
      if (!VALID_CONNECTION_TYPES.has(node.connectionType)) ctx.warnings.push(`Unknown connection type: "${node.connectionType}" for connection "${node.name}"`)
      ctx.connections[node.name] = { type: node.connectionType, args: node.args }
      if (node.local) ctx.localConnectionNames.add(node.name)
      return ''
    }
    case 'define': { ctx.macros[node.name] = { body: node.body, params: node.params }; return '' }
    case 'call': return handleCall(node, ctx)
    case 'phase': return handlePhase(node, ctx)
    case 'conditional': return handleConditional(node, ctx)
    case 'switch': return handleSwitch(node, ctx)
    case 'pipe': return executePipe(node, ctx)
    case 'include': return executeInclude(node, ctx, walkNodes)
    case 'import': { executeImport(node, ctx); return '' }
    case 'list':
    case 'read':
    case 'tree':
    case 'count':
    case 'date':
    case 'db':
    case 'http':
    case 'query': {
      const lines = executeSource(node, ctx)
      const label = 'args' in node && (node as { args: Record<string, string> }).args?.['label']
      if (label && typeof label === 'string') {
        // For single-line scalar-shaped directives (count, date), the value
        // is the first (and only) line. For multi-line sources (read, list,
        // tree, query, db, http) keep the full content joined so labels can
        // carry the whole output for substring tests, foreach sources, etc.
        const scalarShaped = node.type === 'count' || node.type === 'date'
        ctx.envFiles[label] = scalarShaped
          ? (lines[0]?.trim() ?? '')
          : lines.join('\n').trim()
      }
      return lines.join('\n')
    }
    case 'mkdir': return executeMkdir(node, ctx)
    case 'copy': return executeCopy(node, ctx)
    case 'append-if-missing': return executeAppendIfMissing(node, ctx)
    case 'update-frontmatter': return executeUpdateFrontmatter(node, ctx)
    case 'read-frontmatter': return executeReadFrontmatter(node, ctx)
    case 'render-template': return executeRenderTemplate(node, ctx)
    case 'test': return executeTest(node, ctx)
    case 'check': return executeCheck(node, ctx)
    case 'hash': return executeHash(node, ctx)
    case 'foreach': return executeForeach(node, ctx)
    case 'set': return executeSet(node, ctx)
    case 'prompt': return executePrompt(node, ctx)
    case 'note': return executeNote(node, ctx)
    case 'section': return `<!-- mda-section priority="${node.priority}"${node.id ? ` id="${node.id}"` : ''} -->\n${walkNodes(node.body, ctx).join('\n')}\n<!-- /mda-section -->`
    case 'chunk-boundary': return ctx.consumer === 'ai' ? `---chunk:${node.id}---` : `<!-- chunk: ${node.id} -->`
    case 'define-concept': return executeConcept(node, ctx)
    case 'constraint': return executeConstraint(node, ctx)
    case 'event': return executeEvent(node as EventNode, ctx, ctx.docDir)
    case 'markdownai-detect': return executeMarkdownaiDetect(node, ctx)
    case 'plugin-data': return executePluginData(node, ctx)
    // Plugin-file-only blocks (plugin-meta, plugin-detect, plugin-layout, plugin-conventions)
    // are only valid inside .plugin.md files. If they appear in a regular document,
    // emit a warning and produce no output rather than throwing.
    case 'plugin-meta':
    case 'plugin-detect':
    case 'plugin-layout':
    case 'plugin-conventions': {
      ctx.warnings.push(`@${node.type} is only valid inside .plugin.md files and has no output here`)
      return ''
    }
    default: throw new Error(`walkNode: unhandled AST node type "${(node as { type: string }).type}"`)
  }
}

function walkNode(node: ASTNode, ctx: EngineContext): string {
  if (!ctx.traceConfig) return walkNodeCore(node, ctx)

  const id = crypto.randomUUID()
  const startedAt = Date.now()
  const nodeRecord = node as unknown as Record<string, unknown>
  const rawArgs = extractArgs(nodeRecord)
  const maskedArgs: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawArgs)) {
    maskedArgs[k] = applyMasking(v).masked
  }
  const isStructural = node.type === 'markdown' || node.type === 'header'
  const base = {
    id,
    runId: ctx.runId,
    ast: isStructural ? node.type as 'markdown' | 'header' : 'markdownai' as const,
    ...(isStructural ? {} : { directive: node.type }),
    document: ctx.docDir,
    line: (nodeRecord['line'] as number | undefined) ?? 0,
    phase: ctx.phase,
    callstack: [...ctx.callstack],
    args: maskedArgs,
    git: ctx.gitMeta,
    sessionId: ctx.mcp?.sessionId ?? null,
  }

  emitSpan({ ...base, status: 'start', timestamp: startedAt, startedAt }, ctx.traceConfig)

  try {
    const output = walkNodeCore(node, ctx)
    const endedAt = Date.now()
    emitSpan({ ...base, status: 'end', timestamp: endedAt, startedAt, endedAt, duration: endedAt - startedAt, outputSize: Buffer.byteLength(output) }, ctx.traceConfig)
    return output
  } catch (err) {
    const endedAt = Date.now()
    emitSpan({ ...base, status: 'error', timestamp: endedAt, startedAt, endedAt, duration: endedAt - startedAt, error: String(err) }, ctx.traceConfig)
    throw err
  }
}

function executePrompt(node: PromptNode, ctx: EngineContext): string {
  if (ctx.consumer === 'ai') return `[AI INSTRUCTION — ${node.role}]\n${node.body}\n[/AI INSTRUCTION]`
  const lines = node.body.split('\n').map(l => `> ${l}`).join('\n')
  return `> **Note (${node.role}):**\n${lines}`
}

function executeNote(node: NoteNode, ctx: EngineContext): string {
  if (!node.visible) return ''
  if (node.consumer !== undefined) {
    const effective = ctx.consumer ?? 'human'
    if (node.consumer !== effective) return ''
  }
  const lines = node.body.split('\n').map((l: string) => `> ${l}`).join('\n')
  return `> **Note:**\n${lines}`
}

function executeConcept(node: ConceptNode, ctx: EngineContext): string {
  if (node.name) {
    if (ctx.glossary.get(node.name)) ctx.warnings.push(`@define-concept "${node.name}" redefined`)
    ctx.glossary.set(node.name, node.definition)
  }
  if (ctx.consumer === 'human' || ctx.consumer === undefined) return `**${node.name}** — ${node.definition}`
  return ''
}

function executeConstraint(node: ConstraintNode, ctx: EngineContext): string {
  const existing = ctx.constraints.find(c => c.id === node.id)
  if (existing) {
    ctx.warnings.push(`@constraint id="${node.id}" redefined`)
    Object.assign(existing, { severity: node.severity, body: node.body })
  } else {
    ctx.constraints.push({ id: node.id, severity: node.severity, body: node.body })
  }
  if (ctx.consumer === 'human' || ctx.consumer === undefined) {
    return `> **CONSTRAINT [${node.id}] — ${node.severity.toUpperCase()}**\n> ${node.body}`
  }
  return ''
}

function handleCall(node: CallNode, ctx: EngineContext): string {
  const macro = ctx.macros[node.name]
  if (!macro) return ''
  const namedArgs: Record<string, string> = { ...node.args }
  for (let i = 0; i < node.positionalArgs.length; i++) {
    const paramName = macro.params[i]
    if (paramName !== undefined) namedArgs[paramName] = node.positionalArgs[i] ?? ''
  }
  ctx.callstack.push(`call:${node.name}`)
  try {
    return walkNodes(substituteParams(macro.body, namedArgs), ctx).join('\n').trimStart()
  } finally {
    ctx.callstack.pop()
  }
}

function handlePhase(node: PhaseNode, ctx: EngineContext): string {
  if (ctx.phase !== null && ctx.phase !== node.name) return ''
  ctx.callstack.push(`phase:${node.name}`)
  try {
    return walkNodes(node.body, ctx).join('\n').trimStart()
  } finally {
    ctx.callstack.pop()
  }
}

function handleConditional(node: ConditionalNode, ctx: EngineContext): string {
  for (const branch of node.branches) {
    if (branch.condition === null || evalCondition(branch.condition, ctx)) return walkNodes(branch.body, ctx).join('\n').trimStart()
  }
  return ''
}

const SWITCH_INTERP_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g

function evalSwitchValue(expr: string, ctx: EngineContext): string {
  const expanded = expr.replace(SWITCH_INTERP_RE, (_, inner: string) => {
    return JSON.stringify(evalExpression(inner.trim(), ctx))
  })
  return evalExpression(expanded, ctx)
}

function handleSwitch(node: SwitchNode, ctx: EngineContext): string {
  const switchVal = evalSwitchValue(node.expression, ctx)
  for (const c of node.cases) {
    if (evalSwitchValue(c.caseExpression, ctx) === switchVal) {
      return walkNodes(c.body, ctx).join('\n').trimStart()
    }
  }
  if (node.defaultBody !== null) return walkNodes(node.defaultBody, ctx).join('\n').trimStart()
  return ''
}

function executePipe(node: PipeNode, ctx: EngineContext): string {
  let lines: string[] = []
  for (const stage of node.stages) {
    switch (stage.type) {
      case 'source': lines = executeSource(stage.node, ctx); break
      case 'builtin': lines = runBuiltin(stage.command, lines); break
      case 'shell': lines = runShell(stage.command, lines, ctx); break
      case 'sink': {
        const { type: t, columns: cols, ...rest } = stage.node.args
        const input: RendererInput = { type: (t ?? 'list') as RenderType, data: lines }
        if (cols) input.columns = cols.split(',').map((c: string) => c.trim())
        if (Object.keys(rest).length > 0) input.options = rest
        return render(input)
      }
      case 'scalar': return lines.join(' ')
      default: throw new Error(`executePipe: unhandled stage type "${(stage as { type: string }).type}"`)
    }
  }
  return render({ type: 'list', data: lines })
}

function executeSource(node: ASTNode, ctx: EngineContext): string[] {
  switch (node.type) {
    case 'env': { const val = resolveEnv(node.name, node.fallback, ctx); return val === '' ? [] : val.split('\n') }
    case 'list': return executeList(node, ctx)
    case 'read': return executeRead(node, ctx)
    case 'tree': return executeTree(node, ctx)
    case 'count': return executeCount(node, ctx)
    case 'date': return executeDate(node, ctx)
    case 'db': return executeDb(node, ctx)
    case 'http': return executeHttp(node, ctx)
    case 'query': return executeQuery(node, ctx)
    default: throw new Error(`"@${node.type}" cannot be used as a pipe source`)
  }
}
