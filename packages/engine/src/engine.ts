import { readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import type {
  ASTNode, ParseResult, IncludeNode, ImportNode,
  ConnectNode, DefineNode, CallNode, PhaseNode, ConditionalNode, PipeNode,
  InterpolationSpan, RenderNode,
} from '@markdownai/parser'
import { parse } from '@markdownai/parser'
import { render } from '@markdownai/renderer'
import type { RenderType, RendererInput } from '@markdownai/renderer'
import { makeContext, resolveEnv, type EngineContext, type Connection } from './context.js'
import { substituteParams } from './macros.js'
import { evalCondition } from './conditions.js'
import { runBuiltin, isBuiltin } from './pipe.js'
import { runShell } from './shell.js'
import { executeList, executeRead, executeCount, executeDate, executeTree, executeDb, executeHttp, executeQuery, formatDate } from './sources.js'
import { checkFilePath } from './security/filesystem.js'

const MARKDOWNAI_VERSION = '1.0'

class FatalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FatalError'
  }
}

export interface EngineOptions {
  ctx?: Partial<EngineContext>
  filePath?: string
}

export interface EngineResult {
  output: string
  errors: string[]
  warnings: string[]
}

function versionIsNewer(required: string, installed: string): boolean {
  const [rMaj = 0, rMin = 0] = required.split('.').map(Number)
  const [iMaj = 0, iMin = 0] = installed.split('.').map(Number)
  if (rMaj !== iMaj) return rMaj > iMaj
  return rMin > iMin
}

export function execute(ast: ParseResult, options?: EngineOptions): EngineResult {
  if (!ast.isMarkdownAI) {
    return { output: '', errors: ['Not a MarkdownAI document (missing @markdownai header)'], warnings: [] }
  }
  const base = makeContext(options?.ctx)
  const mainFile = options?.filePath ? resolve(options.filePath) : null
  if (mainFile) {
    base.docDir = dirname(mainFile)
    base.resolutionStack.add(mainFile)
    // Set jailRoot once from the main document's directory — never changes during recursion
    if (base.security.jailRoot === null) {
      base.security = { ...base.security, jailRoot: dirname(mainFile) }
    }
  }
  const errors: string[] = []
  const parts: string[] = []

  if (ast.version && versionIsNewer(ast.version, MARKDOWNAI_VERSION)) {
    base.warnings.push(`Document requires @markdownai v${ast.version} but installed version is v${MARKDOWNAI_VERSION}`)
  }

  for (const node of ast.nodes) {
    try {
      const out = walkNode(node, base)
      if (out !== '') parts.push(out)
    } catch (err) {
      errors.push(String(err))
    }
  }
  if (mainFile) {
    base.resolutionStack.delete(mainFile)
    base.completedSet.add(mainFile)
  }
  return { output: parts.join('\n'), errors, warnings: base.warnings }
}

function walkNodes(nodes: ASTNode[], ctx: EngineContext): string[] {
  const parts: string[] = []
  for (const node of nodes) {
    try {
      const out = walkNode(node, ctx)
      if (out !== '') parts.push(out)
    } catch (err) {
      if (err instanceof FatalError) throw err
      ctx.warnings.push(String(err))
    }
  }
  return parts
}

function walkNode(node: ASTNode, ctx: EngineContext): string {
  switch (node.type) {
    case 'header': return ''
    case 'transition': return ''
    case 'passthrough': return node.raw
    case 'graph': return node.raw
    case 'markdown': return resolveInterpolations(node.text, node.interpolations, ctx)
    case 'env': return resolveEnv(node.name, node.fallback, ctx)
    case 'connect': return handleConnect(node, ctx)
    case 'define': return handleDefine(node, ctx)
    case 'call': return handleCall(node, ctx)
    case 'phase': return handlePhase(node, ctx)
    case 'conditional': return handleConditional(node, ctx)
    case 'pipe': return executePipe(node, ctx)
    case 'include': return executeInclude(node, ctx)
    case 'import': { executeImport(node, ctx); return '' }
    case 'list':
    case 'read':
    case 'tree':
    case 'count':
    case 'date':
    case 'db':
    case 'http':
    case 'query': return executeSource(node, ctx).join('\n')
    default: return ''
  }
}

const VALID_CONNECTION_TYPES = new Set(['mongodb', 'postgres', 'mysql', 'mssql', 'sqlite', 'redis', 'elasticsearch'])

function handleConnect(node: ConnectNode, ctx: EngineContext): string {
  if (!VALID_CONNECTION_TYPES.has(node.connectionType)) {
    ctx.warnings.push(`Unknown connection type: "${node.connectionType}" for connection "${node.name}"`)
  }
  ctx.connections[node.name] = { type: node.connectionType, args: node.args }
  if (node.local) ctx.localConnectionNames.add(node.name)
  return ''
}

function handleDefine(node: DefineNode, ctx: EngineContext): string {
  ctx.macros[node.name] = { body: node.body, params: node.params }
  return ''
}

function handleCall(node: CallNode, ctx: EngineContext): string {
  const macro = ctx.macros[node.name]
  if (!macro) return ''
  // Map positional call args to named args using macro param list
  const namedArgs: Record<string, string> = { ...node.args }
  for (let i = 0; i < node.positionalArgs.length; i++) {
    const paramName = macro.params[i]
    if (paramName !== undefined) namedArgs[paramName] = node.positionalArgs[i] ?? ''
  }
  return walkNodes(substituteParams(macro.body, namedArgs), ctx).join('\n')
}

function handlePhase(node: PhaseNode, ctx: EngineContext): string {
  if (ctx.phase !== null && ctx.phase !== node.name) return ''
  return walkNodes(node.body, ctx).join('\n')
}

function handleConditional(node: ConditionalNode, ctx: EngineContext): string {
  for (const branch of node.branches) {
    if (branch.condition === null || evalCondition(branch.condition, ctx)) {
      return walkNodes(branch.body, ctx).join('\n')
    }
  }
  return ''
}

function executePipe(node: PipeNode, ctx: EngineContext): string {
  let lines: string[] = []
  for (const stage of node.stages) {
    switch (stage.type) {
      case 'source': lines = executeSource(stage.node, ctx); break
      case 'builtin': lines = runBuiltin(stage.command, lines); break
      case 'shell': lines = runShell(stage.command, lines, ctx); break
      case 'sink': return renderSink(stage.node, lines)
      case 'scalar': return lines.join(' ')
    }
  }
  return render({ type: 'list', data: lines })
}

function renderSink(node: RenderNode, lines: string[]): string {
  const { type: t, columns: cols, ...rest } = node.args
  const input: RendererInput = { type: (t ?? 'list') as RenderType, data: lines }
  if (cols) input.columns = cols.split(',').map((c: string) => c.trim())
  if (Object.keys(rest).length > 0) input.options = rest
  return render(input)
}

function executeSource(node: ASTNode, ctx: EngineContext): string[] {
  switch (node.type) {
    case 'env': {
      const val = resolveEnv(node.name, node.fallback, ctx)
      return val === '' ? [] : val.split('\n')
    }
    case 'list': return executeList(node, ctx)
    case 'read': return executeRead(node, ctx)
    case 'tree': return executeTree(node, ctx)
    case 'count': return executeCount(node, ctx)
    case 'date': return executeDate(node)
    case 'db': return executeDb(node, ctx)
    case 'http': return executeHttp(node, ctx)
    case 'query': return executeQuery(node, ctx)
    default: throw new Error(`"@${node.type}" cannot be used as a pipe source`)
  }
}


function executeInclude(node: IncludeNode, ctx: EngineContext): string {
  // Evaluate inline condition if present
  if (node.condition !== null && !evalCondition(node.condition, ctx)) return ''

  const jailRoot = ctx.security.jailRoot ?? ctx.docDir
  const check = checkFilePath(node.path, jailRoot, ctx.security.filesystemConfig)
  if (check.level === 'blocked') throw new FatalError(`@include blocked: ${check.reason}`)
  if (check.level === 'alert') ctx.warnings.push(`@include SECURITY_ALERT: ${check.reason} (${node.path})`)

  const full = resolve(ctx.docDir, node.path)
  if (ctx.resolutionStack.has(full)) {
    const chain = [...ctx.resolutionStack, full].join(' → ')
    throw new FatalError(`Circular reference detected: ${chain}`)
  }
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return '' }
  const ast = parse(source, { filePath: full })
  if (!ast.isMarkdownAI) return ''
  ctx.resolutionStack.add(full)
  // Fresh connections copy so @local connections don't leak to parent
  const includeConns: Record<string, Connection> = { ...ctx.connections }
  const includeLocalNames = new Set<string>()
  // phase: null strips @phase wrappers in included files (body always renders)
  const includeCtx = { ...ctx, docDir: dirname(full), phase: null, connections: includeConns, localConnectionNames: includeLocalNames }
  try {
    const out = walkNodes(ast.nodes, includeCtx).join('\n')
    ctx.resolutionStack.delete(full)
    ctx.completedSet.add(full)
    // Merge non-@local connections back to parent
    for (const [name, conn] of Object.entries(includeConns)) {
      if (!includeLocalNames.has(name)) ctx.connections[name] = conn
    }
    return out
  } catch (err) {
    ctx.resolutionStack.delete(full)
    throw err
  }
}

function executeImport(node: ImportNode, ctx: EngineContext): void {
  const jailRoot = ctx.security.jailRoot ?? ctx.docDir
  const check = checkFilePath(node.path, jailRoot, ctx.security.filesystemConfig)
  if (check.level === 'blocked') throw new FatalError(`@import blocked: ${check.reason}`)
  if (check.level === 'alert') ctx.warnings.push(`@import SECURITY_ALERT: ${check.reason} (${node.path})`)

  const full = resolve(ctx.docDir, node.path)
  if (ctx.completedSet.has(full)) return  // first-wins: already imported
  if (ctx.resolutionStack.has(full)) {
    const chain = [...ctx.resolutionStack, full].join(' → ')
    throw new FatalError(`Circular reference detected: ${chain}`)
  }
  let source: string
  try { source = readFileSync(full, 'utf8') } catch { return }
  const ast = parse(source, { filePath: full, inImport: true })
  if (!ast.isMarkdownAI) return
  ctx.resolutionStack.add(full)
  const importCtx = { ...ctx, docDir: dirname(full) }
  for (const n of ast.nodes) {
    if (n.type === 'env' && n.fallback !== null) ctx.envFallbacks[n.name] = n.fallback
    else if (n.type === 'define') ctx.macros[n.name] = { body: n.body, params: n.params }
    else if (n.type === 'connect') ctx.connections[n.name] = { type: n.connectionType, args: n.args }
    else if (n.type === 'import') executeImport(n, importCtx)
  }
  ctx.resolutionStack.delete(full)
  ctx.completedSet.add(full)
}

function resolveInterpolations(text: string, spans: InterpolationSpan[], ctx: EngineContext): string {
  if (spans.length === 0) return text
  let result = ''
  let pos = 0
  for (const span of spans) {
    result += text.slice(pos, span.start)
    result += span.escaped ? `{{${span.expression}}}` : evalExpr(span.expression, ctx)
    pos = span.end
  }
  return result + text.slice(pos)
}

function evalExpr(expr: string, ctx: EngineContext): string {
  const trimmed = expr.trim()

  // Shortcut: bare uppercase env key (e.g. NAME → resolveEnv)
  if (/^[A-Z_][A-Z0-9_]*$/.test(trimmed)) return resolveEnv(trimmed, null, ctx)

  // Directive-style date expression: date format="YYYY"
  const dateFmtMatch = trimmed.match(/^date\s+format="([^"]*)"$/)
  if (dateFmtMatch) return formatDate(new Date(), dateFmtMatch[1] ?? 'ISO')

  const envObj: Record<string, string> = { ...ctx.env, ...ctx.envFiles }
  const fileHelper = {
    exists: (p: string): boolean => existsSync(p),
    isFile: (p: string): boolean => { try { return statSync(p).isFile() } catch { return false } },
    isDir: (p: string): boolean => { try { return statSync(p).isDirectory() } catch { return false } },
  }
  try {
    const result = runInNewContext(trimmed, { ...envObj, env: envObj, file: fileHelper }, { timeout: 500 })
    return String(result ?? '')
  } catch {
    ctx.warnings.push(`Unresolvable expression: ${trimmed}`)
    return ''
  }
}

